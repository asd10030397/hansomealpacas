import type {
  LabeledHolder,
  WalletRelationshipSignals,
} from "@/lib/hansome-score/types";
import {
  isDeployerInEqualBalanceCluster,
  largestEqualBalanceCluster,
} from "@/lib/hansome-score/score";

export type FundingEdge = {
  from: string;
  to: string;
  blockNumber: number | null;
};

export type EarlyBuy = {
  buyer: string;
  blockNumber: number;
};

/** Addresses in the largest identical-balance cluster among non-excluded top holders. */
export function equalBalanceClusterAddresses(holders: LabeledHolder[]): string[] {
  const byBalance = new Map<string, string[]>();
  for (const h of holders) {
    if (h.excludedFromConcentration) continue;
    if (h.label?.toLowerCase().includes("pool")) continue;
    if (h.balanceRaw === "0") continue;
    const list = byBalance.get(h.balanceRaw) ?? [];
    list.push(h.address);
    byBalance.set(h.balanceRaw, list);
  }
  let best: string[] = [];
  for (const list of byBalance.values()) {
    if (list.length > best.length) best = list;
  }
  return best;
}

/** Largest non-deployer shared-funding cohort among top holders. */
export function sharedFundingCluster(params: {
  holders: LabeledHolder[];
  deployer: string | null;
  fundingEdges: FundingEdge[];
}): { funder: string | null; addresses: string[] } {
  const { holders, deployer, fundingEdges } = params;
  const topAddrs = new Set(
    holders
      .filter((h) => !h.excludedFromConcentration)
      .slice(0, 20)
      .map((h) => h.address.toLowerCase()),
  );
  const deployerLc = deployer?.toLowerCase() ?? null;

  const funderToHolders = new Map<string, Set<string>>();
  for (const e of fundingEdges) {
    const to = e.to.toLowerCase();
    const from = e.from.toLowerCase();
    if (!topAddrs.has(to)) continue;
    if (deployerLc && from === deployerLc) continue;
    if (!funderToHolders.has(from)) funderToHolders.set(from, new Set());
    funderToHolders.get(from)!.add(to);
  }

  let bestFunder: string | null = null;
  let best: string[] = [];
  for (const [funder, set] of funderToHolders) {
    if (set.size > best.length) {
      best = [...set];
      bestFunder = funder;
    }
  }
  return { funder: bestFunder, addresses: best };
}

/**
 * Build probabilistic relationship signals from equal-balance + funding/early-buy graphs.
 * Wording must remain probabilistic — never claim common ownership.
 */
export function buildRelationshipSignals(params: {
  holders: LabeledHolder[];
  deployer: string | null;
  fundingEdges: FundingEdge[];
  earlyBuys: EarlyBuy[];
}): WalletRelationshipSignals {
  const { holders, deployer, fundingEdges, earlyBuys } = params;
  const topAddrs = new Set(
    holders
      .filter((h) => !h.excludedFromConcentration)
      .slice(0, 20)
      .map((h) => h.address.toLowerCase()),
  );

  const equalAddrs = equalBalanceClusterAddresses(holders);
  const shared = sharedFundingCluster({ holders, deployer, fundingEdges });

  let deployerFundedAddresses: string[] = [];
  if (deployer) {
    const dep = deployer.toLowerCase();
    const funded = new Set<string>();
    for (const e of fundingEdges) {
      if (e.from.toLowerCase() === dep && topAddrs.has(e.to.toLowerCase())) {
        funded.add(e.to.toLowerCase());
      }
    }
    deployerFundedAddresses = [...funded];
  }

  const blockCounts = new Map<number, Set<string>>();
  for (const b of earlyBuys) {
    const buyer = b.buyer.toLowerCase();
    if (!topAddrs.has(buyer)) continue;
    if (!blockCounts.has(b.blockNumber)) blockCounts.set(b.blockNumber, new Set());
    blockCounts.get(b.blockNumber)!.add(buyer);
  }
  let sameBlockEarlyBuyAddresses: string[] = [];
  for (const set of blockCounts.values()) {
    if (set.size > sameBlockEarlyBuyAddresses.length) {
      sameBlockEarlyBuyAddresses = [...set];
    }
  }

  return {
    equalBalanceClusterSize: largestEqualBalanceCluster(holders),
    equalBalanceClusterAddresses: equalAddrs,
    deployerInEqualBalanceCluster: isDeployerInEqualBalanceCluster(holders, deployer),
    sharedFundingCount: shared.addresses.length,
    sharedFundingAddresses: shared.addresses,
    sharedFundingFunder: shared.funder,
    deployerFundedCount: deployerFundedAddresses.length,
    deployerFundedAddresses,
    sameBlockEarlyBuyCount: sameBlockEarlyBuyAddresses.length,
    sameBlockEarlyBuyAddresses,
  };
}
