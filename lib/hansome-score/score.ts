import {
  CATEGORY_CAPS,
  INCOMPLETE_CRITICAL_SCORE_CEILING,
} from "@/lib/hansome-score/constants";
import type {
  ContractRiskResult,
  DeductionCategory,
  LabeledHolder,
  LpLockState,
  RiskFlag,
  ScoreDeduction,
  ScoreResult,
  WalletRelationshipSignals,
} from "@/lib/hansome-score/types";

export type ScoreInput = {
  totalSupply: bigint | null;
  topHolders: LabeledHolder[];
  deployer: string | null;
  deployerBalance: bigint | null;
  contractVerified: boolean | null;
  lpLockState: LpLockState;
  poolManagerBalance: bigint | null;
  contractRisk: ContractRiskResult;
  relationship: WalletRelationshipSignals;
  creatorBehaviourAvailable: boolean;
  creatorDumpDetected: boolean;
  creatorTransferThenSellDetected: boolean;
};

function clampCategory(
  category: DeductionCategory,
  points: number,
  used: Record<DeductionCategory, number>,
): number {
  const remaining = CATEGORY_CAPS[category] - used[category];
  return Math.max(0, Math.min(points, remaining));
}

function addDeduction(
  deductions: ScoreDeduction[],
  used: Record<DeductionCategory, number>,
  category: DeductionCategory,
  points: number,
  code: string,
  reason: string,
  extras?: { wallets?: string[]; mergedFrom?: string[] },
) {
  const applied = clampCategory(category, points, used);
  if (applied <= 0) return;
  used[category] += applied;
  deductions.push({
    category,
    points: applied,
    code,
    reason,
    ...(extras?.wallets?.length ? { wallets: extras.wallets } : {}),
    ...(extras?.mergedFrom?.length ? { mergedFrom: extras.mergedFrom } : {}),
  });
}

/** Same-cluster overlap gate for equal_balance vs shared_funding (see relationship.ts). */
export function isMaterialWalletClusterOverlap(
  a: string[],
  b: string[],
): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setA = new Set(a.map((x) => x.toLowerCase()));
  const setB = new Set(b.map((x) => x.toLowerCase()));
  const intersection = [...setA].filter((x) => setB.has(x));
  if (intersection.length < 2) return false;
  const smaller = Math.min(setA.size, setB.size);
  return intersection.length / smaller >= 0.5;
}

function emptyUsed(): Record<DeductionCategory, number> {
  return {
    contract_risk: 0,
    liquidity_ownership: 0,
    holder_concentration: 0,
    wallet_relationship: 0,
    launch_fairness: 0,
    creator_behaviour: 0,
  };
}

/**
 * Pure structural score v1.1: base 100 minus capped category deductions.
 * Liquidity SIZE is never deducted here — ownership/withdrawal only.
 */
export function computeStructuralScore(input: ScoreInput): ScoreResult {
  const deductions: ScoreDeduction[] = [];
  const flags: RiskFlag[] = [];
  const used = emptyUsed();
  const incompleteCategories: DeductionCategory[] = [];

  // --- Contract risk ---
  const cr = input.contractRisk;
  if (cr.status === "incomplete") {
    incompleteCategories.push("contract_risk");
    addDeduction(
      deductions,
      used,
      "contract_risk",
      10,
      "contract_risk_incomplete",
      "Contract risk incomplete (no verified ABI/source) — provisional deduction; unknown ≠ safe.",
    );
    flags.push({
      severity: "warning",
      code: "contract_risk_incomplete",
      message:
        "Contract checks incomplete — Score does not award full contract-risk credit.",
    });
  } else {
    if (cr.honeypot) {
      addDeduction(
        deductions,
        used,
        "contract_risk",
        25,
        "honeypot",
        "Honeypot / cannot-sell pattern detected in verified analysis.",
      );
      flags.push({
        severity: "risk",
        code: "honeypot",
        message: "Honeypot-like pattern detected — highest contract-risk severity.",
      });
    }
    if (cr.mintable) {
      addDeduction(
        deductions,
        used,
        "contract_risk",
        18,
        "mintable",
        "Mint / supply-increase authority present.",
      );
      flags.push({
        severity: "risk",
        code: "mintable",
        message: "Token appears mintable post-deploy.",
      });
    }
    const maxTax = Math.max(
      cr.buyTaxBps ?? 0,
      cr.sellTaxBps ?? 0,
      cr.transferTaxBps ?? 0,
    );
    if (maxTax >= 5000) {
      addDeduction(
        deductions,
        used,
        "contract_risk",
        20,
        "tax_ge_50",
        `Transfer tax ≥ 50% (max observed ${maxTax / 100}%).`,
      );
    } else if (maxTax > 0) {
      addDeduction(
        deductions,
        used,
        "contract_risk",
        10,
        "tax_gt_0",
        `Non-zero transfer tax detected (max ${maxTax / 100}%).`,
      );
    }
    if (cr.modifiableTax) {
      addDeduction(
        deductions,
        used,
        "contract_risk",
        12,
        "modifiable_tax",
        "Modifiable tax/fee authority detected.",
      );
    }
    if (cr.pausable) {
      addDeduction(
        deductions,
        used,
        "contract_risk",
        10,
        "pausable",
        "Pause capability detected.",
      );
    }
    if (cr.blacklistOrWhitelist) {
      addDeduction(
        deductions,
        used,
        "contract_risk",
        12,
        "blacklist_whitelist",
        "Blacklist/whitelist transfer gating detected.",
      );
    }
    if (cr.isProxy) {
      addDeduction(
        deductions,
        used,
        "contract_risk",
        15,
        "proxy_upgrade",
        "Proxy / upgrade privilege surface detected.",
      );
    }
    if (cr.hasOwnerAdmin) {
      addDeduction(
        deductions,
        used,
        "contract_risk",
        8,
        "owner_admin",
        "Owner/admin privilege surface detected.",
      );
    }
    // Privileged/admin burn of arbitrary holders — Contract Risk only.
    // Ordinary voluntary burn / dead-address inventory must NOT score here.
    if (cr.privilegedBurn === true) {
      addDeduction(
        deductions,
        used,
        "contract_risk",
        12,
        "privileged_burn",
        "Privileged/admin burn surface — can burn or confiscate from arbitrary holders.",
      );
      flags.push({
        severity: "risk",
        code: "privileged_burn",
        message:
          "Privileged burn detected — confiscation risk (not a deflationary quality signal).",
      });
    }
  }

  // --- Liquidity ownership (from explicit lock states) ---
  const poolBal = input.poolManagerBalance ?? 0n;
  const lock = input.lpLockState;

  if (lock === "NONE" || poolBal === 0n) {
    addDeduction(
      deductions,
      used,
      "liquidity_ownership",
      8,
      "lp_none",
      "No detectable AMM pool balance for this token.",
    );
    flags.push({
      severity: "warning",
      code: "thin_or_missing_lp",
      message:
        "Thin or missing liquidity warning — size alone does not mean unsafe, but trading may be difficult.",
    });
  } else if (lock === "UNLOCKED_EOA_CONTROLLED") {
    addDeduction(
      deductions,
      used,
      "liquidity_ownership",
      20,
      "lp_unlocked_eoa",
      "Liquidity Position NFT appears unlocked / EOA-controlled — withdrawal risk.",
    );
    flags.push({
      severity: "risk",
      code: "unlocked_lp",
      message: "UNLOCKED / EOA-CONTROLLED — withdrawal risk affects structural Score.",
    });
  } else if (lock === "MIXED") {
    addDeduction(
      deductions,
      used,
      "liquidity_ownership",
      8,
      "lp_mixed",
      "Mixed LP ownership: verified lock(s) coexist with removable position(s). One locked Position NFT does not mean locked liquidity.",
    );
    flags.push({
      severity: "warning",
      code: "lp_mixed",
      message:
        "⚠️ MIXED — LOCKED + REMOVABLE. Do not treat the token as fully LP-locked.",
    });
  } else if (lock === "LOCK_DETECTED_EXPIRY_UNKNOWN") {
    addDeduction(
      deductions,
      used,
      "liquidity_ownership",
      5,
      "lp_lock_expiry_unknown",
      "Lock detected via known/unsupported path but unlock expiry unknown.",
    );
  } else if (lock === "UNSUPPORTED_LOCKER") {
    addDeduction(
      deductions,
      used,
      "liquidity_ownership",
      12,
      "lp_unsupported_locker",
      "Position NFT held by unrecognized locker contract.",
    );
  } else if (lock === "UNABLE_TO_DETERMINE") {
    addDeduction(
      deductions,
      used,
      "liquidity_ownership",
      12,
      "lp_unable_to_determine",
      "Pool exists but LP lock ownership UNABLE TO DETERMINE — not assumed locked or unlocked.",
    );
    flags.push({
      severity: "warning",
      code: "lp_unable_to_determine",
      message:
        "LP lock UNABLE TO DETERMINE — never mapped to unlocked; ownership risk not fully verified.",
    });
  } else if (lock === "LOCKED_VERIFIED_ONCHAIN") {
    flags.push({
      severity: "info",
      code: "lp_all_locked_verified",
      message:
        "ALL LOCKED — every material detected position verified on-chain (discovery marked complete).",
    });
  }

  // --- Holder concentration ---
  const included = input.topHolders.filter((h) => !h.excludedFromConcentration);
  const top1 = included[0]?.percentOfSupply ?? 0;
  const top10 = included.slice(0, 10).reduce((s, h) => s + h.percentOfSupply, 0);

  if (top1 >= 50) {
    addDeduction(
      deductions,
      used,
      "holder_concentration",
      20,
      "top1_ge_50",
      `Top holder (excl. pool/burn) holds ~${top1.toFixed(1)}% of supply.`,
    );
  } else if (top1 >= 30) {
    addDeduction(
      deductions,
      used,
      "holder_concentration",
      14,
      "top1_ge_30",
      `Top holder (excl. pool/burn) holds ~${top1.toFixed(1)}% of supply.`,
    );
  } else if (top1 >= 20) {
    addDeduction(
      deductions,
      used,
      "holder_concentration",
      10,
      "top1_ge_20",
      `Top holder (excl. pool/burn) holds ~${top1.toFixed(1)}% of supply.`,
    );
  } else if (top1 >= 10) {
    addDeduction(
      deductions,
      used,
      "holder_concentration",
      6,
      "top1_ge_10",
      `Top holder (excl. pool/burn) holds ~${top1.toFixed(1)}% of supply.`,
    );
  } else if (top1 >= 5) {
    addDeduction(
      deductions,
      used,
      "holder_concentration",
      3,
      "top1_ge_5",
      `Top holder (excl. pool/burn) holds ~${top1.toFixed(1)}% of supply.`,
    );
  }

  if (top10 >= 80) {
    addDeduction(
      deductions,
      used,
      "holder_concentration",
      8,
      "top10_ge_80",
      `Top-10 (excl. pool/burn) hold ~${top10.toFixed(1)}% of supply.`,
    );
  } else if (top10 >= 60) {
    addDeduction(
      deductions,
      used,
      "holder_concentration",
      6,
      "top10_ge_60",
      `Top-10 (excl. pool/burn) hold ~${top10.toFixed(1)}% of supply.`,
    );
  } else if (top10 >= 50) {
    addDeduction(
      deductions,
      used,
      "holder_concentration",
      4,
      "top10_ge_50",
      `Top-10 (excl. pool/burn) hold ~${top10.toFixed(1)}% of supply.`,
    );
  } else if (top10 >= 40) {
    addDeduction(
      deductions,
      used,
      "holder_concentration",
      2,
      "top10_ge_40",
      `Top-10 (excl. pool/burn) hold ~${top10.toFixed(1)}% of supply.`,
    );
  }

  // --- Wallet relationship (probabilistic) ---
  // Equal-balance + shared-funding: do not stack full deductions when both
  // describe the same underlying wallet cluster (primary = equal_balance_cluster).
  const rel = input.relationship;
  const equalWallets = rel.equalBalanceClusterAddresses ?? [];
  const sharedWallets = rel.sharedFundingAddresses ?? [];
  const equalSharedSameCluster = isMaterialWalletClusterOverlap(
    equalWallets,
    sharedWallets,
  );
  const equalFires = rel.equalBalanceClusterSize >= 3;
  const sharedFires = rel.sharedFundingCount >= 2;

  if (equalFires) {
    const mergedNote =
      equalSharedSameCluster && sharedFires
        ? " Shared funding pattern corroborates the same wallet cluster (not stacked)."
        : "";
    addDeduction(
      deductions,
      used,
      "wallet_relationship",
      6,
      "equal_balance_cluster",
      `Possible related wallets (probabilistic): ${rel.equalBalanceClusterSize} top holders share identical balances.${mergedNote}`,
      {
        wallets: equalWallets,
        mergedFrom:
          equalSharedSameCluster && sharedFires
            ? ["shared_funding_pattern"]
            : undefined,
      },
    );
    flags.push({
      severity: "risk",
      code: "possible_related_wallets",
      message:
        "Possible related wallets (probabilistic — not proof of common ownership).",
    });
  }
  if (sharedFires && !(equalFires && equalSharedSameCluster)) {
    addDeduction(
      deductions,
      used,
      "wallet_relationship",
      5,
      "shared_funding_pattern",
      `Shared funding pattern (probabilistic): ${rel.sharedFundingCount} top holders share a common funder.`,
      { wallets: sharedWallets },
    );
  }
  if (rel.deployerFundedCount >= 2) {
    addDeduction(
      deductions,
      used,
      "wallet_relationship",
      5,
      "deployer_funded_holders",
      `Deployer-funded holders (probabilistic): ${rel.deployerFundedCount} top holders received native/token from deployer.`,
      { wallets: rel.deployerFundedAddresses ?? [] },
    );
  }
  if (rel.sameBlockEarlyBuyCount >= 3) {
    addDeduction(
      deductions,
      used,
      "wallet_relationship",
      4,
      "same_block_early_buys",
      `Same-block early buy pattern (probabilistic): ${rel.sameBlockEarlyBuyCount} EOAs bought in the same early block.`,
      { wallets: rel.sameBlockEarlyBuyAddresses ?? [] },
    );
  }
  if (rel.deployerInEqualBalanceCluster) {
    addDeduction(
      deductions,
      used,
      "wallet_relationship",
      4,
      "deployer_in_cluster",
      "Deployer appears inside an equal-balance top-holder cluster (probabilistic).",
      { wallets: equalWallets },
    );
  }

  // --- Launch fairness ---
  if (input.totalSupply && input.totalSupply > 0n && input.deployerBalance != null) {
    const pct =
      (Number(input.deployerBalance) / Number(input.totalSupply)) * 100;
    if (pct >= 20) {
      addDeduction(
        deductions,
        used,
        "launch_fairness",
        10,
        "deployer_ge_20",
        `Deployer currently holds ~${pct.toFixed(1)}% of supply.`,
      );
    } else if (pct >= 10) {
      addDeduction(
        deductions,
        used,
        "launch_fairness",
        8,
        "deployer_ge_10",
        `Deployer currently holds ~${pct.toFixed(1)}% of supply.`,
      );
    } else if (pct >= 5) {
      addDeduction(
        deductions,
        used,
        "launch_fairness",
        4,
        "deployer_ge_5",
        `Deployer currently holds ~${pct.toFixed(1)}% of supply.`,
      );
    }
  }

  if (input.contractVerified === false) {
    addDeduction(
      deductions,
      used,
      "launch_fairness",
      3,
      "unverified_contract",
      "Contract is not verified on the explorer.",
    );
    flags.push({
      severity: "risk",
      code: "unverified",
      message: "Contract source not verified on Blockscout.",
    });
  }

  // --- Creator behaviour ---
  if (!input.creatorBehaviourAvailable) {
    incompleteCategories.push("creator_behaviour");
    addDeduction(
      deductions,
      used,
      "creator_behaviour",
      8,
      "creator_behaviour_unindexed",
      "Creator sell/transfer history unavailable — provisional deduction (unknown ≠ safe).",
    );
    flags.push({
      severity: "warning",
      code: "creator_behaviour_incomplete",
      message:
        "Creator behaviour index incomplete — Score withholds full creator-behaviour credit.",
    });
  } else if (input.creatorDumpDetected) {
    addDeduction(
      deductions,
      used,
      "creator_behaviour",
      10,
      "creator_dump",
      "Evidence of large creator sell (>5% supply) post-launch.",
    );
  } else if (input.creatorTransferThenSellDetected) {
    addDeduction(
      deductions,
      used,
      "creator_behaviour",
      7,
      "creator_transfer_then_sell",
      "Material creator transfers to fresh EOAs then sell (pattern).",
    );
  }

  const totalDeduction = Object.values(used).reduce((a, b) => a + b, 0);
  let score = Math.max(0, Math.min(100, 100 - totalDeduction));

  let scoreCeilingApplied: number | null = null;
  const criticalIncomplete =
    incompleteCategories.includes("contract_risk") &&
    incompleteCategories.includes("creator_behaviour");
  if (criticalIncomplete) {
    scoreCeilingApplied = INCOMPLETE_CRITICAL_SCORE_CEILING;
    if (score > INCOMPLETE_CRITICAL_SCORE_CEILING) {
      score = INCOMPLETE_CRITICAL_SCORE_CEILING;
    }
    flags.push({
      severity: "warning",
      code: "score_ceiling_incomplete",
      message: `Score ceiling ${INCOMPLETE_CRITICAL_SCORE_CEILING} in effect — contract risk and creator behaviour both incomplete.`,
    });
  }

  return {
    score,
    base: 100,
    deductions,
    categoryTotals: used,
    flags,
    scoreCeilingApplied,
    incompleteCategories,
  };
}

/** Largest set of EOAs in top holders sharing the exact same raw balance. */
export function largestEqualBalanceCluster(holders: LabeledHolder[]): number {
  const counts = new Map<string, number>();
  for (const h of holders) {
    if (h.excludedFromConcentration) continue;
    if (h.label?.toLowerCase().includes("pool")) continue;
    const key = h.balanceRaw;
    if (key === "0") continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let max = 0;
  for (const n of counts.values()) max = Math.max(max, n);
  return max;
}

/** Whether deployer shares an identical balance with ≥2 other non-excluded top holders. */
export function isDeployerInEqualBalanceCluster(
  holders: LabeledHolder[],
  deployer: string | null,
): boolean {
  if (!deployer) return false;
  const deployerLc = deployer.toLowerCase();
  const deployerRow = holders.find((h) => h.address.toLowerCase() === deployerLc);
  if (!deployerRow || deployerRow.excludedFromConcentration) return false;
  if (deployerRow.balanceRaw === "0") return false;
  const peers = holders.filter(
    (h) =>
      !h.excludedFromConcentration &&
      h.balanceRaw === deployerRow.balanceRaw &&
      h.address.toLowerCase() !== deployerLc,
  );
  return peers.length >= 2;
}

export function computeConcentration(holders: LabeledHolder[]): {
  top1AdjustedPct: number;
  top10AdjustedPct: number;
  top10RawPct: number;
  exclusions: string[];
} {
  const exclusions = holders
    .filter((h) => h.excludedFromConcentration)
    .map((h) => `${h.address}${h.label ? ` (${h.label})` : ""}`);
  const adjusted = holders.filter((h) => !h.excludedFromConcentration);
  const top1AdjustedPct = adjusted[0]?.percentOfSupply ?? 0;
  const top10AdjustedPct = adjusted
    .slice(0, 10)
    .reduce((s, h) => s + h.percentOfSupply, 0);
  const top10RawPct = holders.slice(0, 10).reduce((s, h) => s + h.percentOfSupply, 0);
  return { top1AdjustedPct, top10AdjustedPct, top10RawPct, exclusions };
}
