import type { ContractRiskResult, ContractRiskFinding } from "@/lib/hansome-score/types";
import { detectBurnMechanisms } from "@/lib/hansome-score/supply-burn/mechanisms";

type AbiItem = {
  type?: string;
  name?: string;
  stateMutability?: string;
  inputs?: { name?: string; type?: string }[];
};

export type ContractRiskInput = {
  verified: boolean | null;
  abi: AbiItem[] | null;
  sourceCode: string | null;
  /** Optional GoPlus fields — labeled supplement only. */
  goplus?: Record<string, string | number | boolean | null> | null;
  /**
   * Optional privileged-burn tri-state from Supply & Burn P1.
   * When omitted, Contract Risk runs the same ABI/source detector.
   */
  privilegedBurn?: "yes" | "no" | "unknown";
};

function hasFn(abi: AbiItem[] | null, names: string[]): boolean {
  if (!abi) return false;
  const set = new Set(
    abi.filter((x) => x.type === "function" && x.name).map((x) => x.name!.toLowerCase()),
  );
  return names.some((n) => set.has(n.toLowerCase()));
}

/** Strip Solidity comments/strings so NatSpec like "no honeypot" cannot false-positive. */
function stripSolidityNoise(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function sourceMentions(source: string | null, patterns: RegExp[]): boolean {
  if (!source) return false;
  const code = stripSolidityNoise(source);
  return patterns.some((p) => p.test(code));
}

/**
 * Analyze contract privilege / tax / mint surface from verified ABI + source.
 * GoPlus never silently overrides source/ABI conclusions.
 */
export function analyzeContractRisk(input: ContractRiskInput): ContractRiskResult {
  const findings: ContractRiskFinding[] = [];
  const goplus = input.goplus ?? null;

  if (input.verified !== true || (!input.abi && !input.sourceCode)) {
    findings.push({
      code: "contract_risk_incomplete",
      severity: "warning",
      message:
        "Contract risk analysis incomplete — missing verified ABI/source. Unknown ≠ safe.",
      source: "provisional",
    });
    return {
      status: "incomplete",
      mintable: null,
      honeypot: null,
      buyTaxBps: null,
      sellTaxBps: null,
      transferTaxBps: null,
      modifiableTax: null,
      pausable: null,
      blacklistOrWhitelist: null,
      isProxy: null,
      hasOwnerAdmin: null,
      privilegedBurn: null,
      findings,
      goplusSupplement: goplus,
      detail: "Provisional incomplete — Score withholds full contract-risk credit.",
    };
  }

  const abi = input.abi;
  const source = input.sourceCode;

  const mintable =
    hasFn(abi, ["mint", "mintTo", "increaseSupply"]) ||
    sourceMentions(source, [
      /\bfunction\s+mint\b/i,
      /\b_mint\s*\([^)]+\)\s*(?!.*constructor)/i,
    ]);

  // Constructor-only _mint is OK for fixed supply — detect post-deploy mint surface via ABI public mint
  const mintableAbi = hasFn(abi, ["mint", "mintTo", "increaseSupply"]);
  const isMintable = mintableAbi;

  const pausable =
    hasFn(abi, ["pause", "unpause"]) ||
    sourceMentions(source, [/Pausable/, /\bfunction\s+pause\b/i]);

  const blacklistOrWhitelist =
    hasFn(abi, [
      "blacklist",
      "addBlacklist",
      "setBlacklist",
      "setWhitelist",
      "whitelist",
      "addToBlacklist",
      "excludeFromFee",
    ]) ||
    sourceMentions(source, [
      /\bmapping\s*\(\s*address\s*=>\s*bool\s*\)\s*(public\s+)?(black|white)_?list/i,
      /\bisBlacklisted\b/i,
    ]);

  const hasOwnerAdmin =
    hasFn(abi, ["owner", "getOwner", "transferOwnership", "renounceOwnership"]) ||
    sourceMentions(source, [/Ownable/, /\bonlyOwner\b/]);

  const isProxy =
    hasFn(abi, ["implementation", "upgradeTo", "upgradeToAndCall"]) ||
    sourceMentions(source, [/UUPSUpgradeable/, /TransparentUpgradeableProxy/, /delegatecall/i]);

  const modifiableTax =
    hasFn(abi, [
      "setTax",
      "setFee",
      "setFees",
      "setBuyTax",
      "setSellTax",
      "setTransferTax",
      "updateFees",
    ]) ||
    sourceMentions(source, [/\bset(Buy|Sell|Transfer)?(Tax|Fee)\b/i]);

  // Tax rate: only from explicit source constants when obvious; else null (not assumed 0 from silence unless clean ERC20)
  let buyTaxBps: number | null = null;
  let sellTaxBps: number | null = null;
  let transferTaxBps: number | null = null;

  const cleanErc20 =
    !isMintable &&
    !pausable &&
    !blacklistOrWhitelist &&
    !isProxy &&
    !modifiableTax &&
    sourceMentions(source, [/ERC20/, /OpenZeppelin/]) &&
    !sourceMentions(source, [/\btax\b/i, /\bfee\s*=\s*[1-9]/i, /reflect/i, /rTotal/i]);

  if (cleanErc20) {
    buyTaxBps = 0;
    sellTaxBps = 0;
    transferTaxBps = 0;
  }

  // Honeypot: no simulation — only affirmative code identifiers (comments already stripped)
  const honeypot = sourceMentions(source, [
    /\bfunction\s+cannotSell\b/i,
    /\b_blockSell\b/,
    /\bisHoneypot\b/i,
    /\bmapping\s*\([^)]*\)\s*[^{]*blacklist[^{]*\{[^}]*transfer/i,
  ]);

  if (isMintable) {
    findings.push({
      code: "mintable",
      severity: "risk",
      message: "Mint / supply-increase function present in ABI.",
      source: "abi_source",
    });
  }
  if (pausable) {
    findings.push({
      code: "pausable",
      severity: "risk",
      message: "Pause capability detected.",
      source: "abi_source",
    });
  }
  if (blacklistOrWhitelist) {
    findings.push({
      code: "blacklist_whitelist",
      severity: "risk",
      message: "Blacklist/whitelist transfer gating surface detected.",
      source: "abi_source",
    });
  }
  if (isProxy) {
    findings.push({
      code: "proxy_upgrade",
      severity: "risk",
      message: "Proxy / upgrade authority surface detected.",
      source: "abi_source",
    });
  }
  if (hasOwnerAdmin) {
    findings.push({
      code: "owner_admin",
      severity: "warning",
      message: "Owner/admin privilege surface detected (Ownable-style).",
      source: "abi_source",
    });
  }
  if (modifiableTax) {
    findings.push({
      code: "modifiable_tax",
      severity: "risk",
      message: "Modifiable tax/fee authority detected.",
      source: "abi_source",
    });
  }
  if (honeypot) {
    findings.push({
      code: "honeypot_pattern",
      severity: "risk",
      message: "Honeypot-like pattern in source (heuristic).",
      source: "abi_source",
    });
  }

  // Privileged burn — Supply & Burn P1 (voluntary holder burn is NOT scored here)
  const burnDet =
    input.privilegedBurn != null
      ? { privilegedBurn: input.privilegedBurn }
      : detectBurnMechanisms({
          verified: input.verified,
          abi,
          sourceCode: source,
        });
  const privilegedBurnFlag =
    burnDet.privilegedBurn === "yes"
      ? true
      : burnDet.privilegedBurn === "no"
        ? false
        : null;
  if (privilegedBurnFlag === true) {
    findings.push({
      code: "privileged_burn",
      severity: "risk",
      message:
        "Privileged/admin burn surface detected — ability to burn or confiscate from arbitrary holders.",
      source: "abi_source",
    });
  }

  // GoPlus supplement — label conflicts, never override
  if (goplus) {
    const gpMint = String(goplus.is_mintable ?? "");
    if (gpMint === "1" && !isMintable) {
      findings.push({
        code: "goplus_mint_conflict",
        severity: "info",
        message:
          "GoPlus labels mintable=1 but verified ABI/source shows no mint — GoPlus not applied to Score.",
        source: "goplus_labeled",
      });
    }
    if (gpMint === "0" && isMintable) {
      findings.push({
        code: "goplus_mint_underreport",
        severity: "info",
        message:
          "GoPlus labels mintable=0 but ABI shows mint — Score uses ABI/source.",
        source: "goplus_labeled",
      });
    }
    const gpOwnerBal = String(goplus.owner_change_balance ?? "");
    if (gpOwnerBal === "1" && privilegedBurnFlag !== true) {
      findings.push({
        code: "goplus_owner_change_balance",
        severity: "info",
        message:
          "GoPlus labels owner_change_balance=1 — labeled supplement only; not sole privileged-burn Score evidence.",
        source: "goplus_labeled",
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      code: "contract_clean",
      severity: "info",
      message:
        "No mint/tax/pause/blacklist/proxy/privileged-burn privilege surface found in verified ABI/source.",
      source: "abi_source",
    });
  }

  // unused var guard — mintable heuristic kept for future source-only mint detection
  void mintable;

  return {
    status: "analyzed",
    mintable: isMintable,
    honeypot,
    buyTaxBps,
    sellTaxBps,
    transferTaxBps,
    modifiableTax,
    pausable,
    blacklistOrWhitelist,
    isProxy,
    hasOwnerAdmin,
    privilegedBurn: privilegedBurnFlag,
    findings,
    goplusSupplement: goplus,
    detail:
      cleanErc20 && privilegedBurnFlag !== true
        ? "Verified clean fixed-supply ERC-20 surface (no privileged mint/tax/pause/blacklist/proxy/burn)."
        : "Verified ABI/source analyzed for privilege surfaces.",
  };
}
