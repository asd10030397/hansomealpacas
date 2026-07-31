import { formatTokenAmount } from "@/lib/hansome-score/rpc";
import type { BlockscoutTokenTransferRow } from "@/lib/hansome-score/blockscout";
import {
  emptyBurnActivityHistory,
  emptySupplyReductionHistory,
} from "@/lib/hansome-score/supply-burn/burn-history";
import {
  attachBurnHistoryToSupplyBurn,
  buildBurnHistoryFromTransferIndex,
  upsertBurnHistoryFromScan,
  type StoredBurnHistory,
} from "@/lib/hansome-score/supply-burn/burn-cache";
import { fetchDeadAddressInventory } from "@/lib/hansome-score/supply-burn/dead-inventory";
import {
  classifyBurnMechanism,
  combineBurnFunction,
  detectBurnMechanisms,
} from "@/lib/hansome-score/supply-burn/mechanisms";
import type {
  AbiItem,
  SupplyBurnIntelligence,
} from "@/lib/hansome-score/supply-burn/types";

export type AnalyzeSupplyBurnInput = {
  tokenAddress: string;
  totalSupply: bigint | null;
  decimals: number | null;
  verified: boolean | null;
  abi: AbiItem[] | null;
  sourceCode: string | null;
  /**
   * Optional pre-fetched dead inventory (tests / callers that already RPC'd).
   * When omitted, fetches allowlisted dead balances via RPC.
   */
  deadInventory?: Awaited<ReturnType<typeof fetchDeadAddressInventory>>;
};

function buildSupplyBurnFromParts(
  input: AnalyzeSupplyBurnInput & {
    deadInventory: Awaited<ReturnType<typeof fetchDeadAddressInventory>>;
  },
): SupplyBurnIntelligence {
  const dataCompletenessNotes: string[] = [...input.deadInventory.notes];
  const totalSupplyFormatted = formatTokenAmount(
    input.totalSupply,
    input.decimals,
  );
  const dead = input.deadInventory;
  const mechanisms = detectBurnMechanisms({
    verified: input.verified,
    abi: input.abi,
    sourceCode: input.sourceCode,
  });
  dataCompletenessNotes.push(...mechanisms.notes);

  const knownBurnedRaw = dead.knownBurnedRaw;
  let effectiveRemainingSupplyRaw: string | null = null;
  let effectiveRemainingSupplyFormatted: string | null = null;
  let effectiveRemainingMethod: SupplyBurnIntelligence["effectiveRemainingMethod"] =
    "unavailable";

  if (
    input.totalSupply != null &&
    knownBurnedRaw != null &&
    input.totalSupply >= knownBurnedRaw
  ) {
    const remaining = input.totalSupply - knownBurnedRaw;
    effectiveRemainingSupplyRaw = remaining.toString();
    effectiveRemainingSupplyFormatted = formatTokenAmount(
      remaining,
      input.decimals,
    );
    effectiveRemainingMethod = "total_minus_known_dead";
    dataCompletenessNotes.push(
      "Effective remaining = totalSupply − known dead-address balances (dead inventory view; not verified circulating / CoinGecko parity).",
    );
  }

  dataCompletenessNotes.push(
    "Supply permanently reduced (totalSupply decrease) requires P3 burn-method evidence — dead-address inventory is separate from supply-reducing burns.",
  );
  dataCompletenessNotes.push(
    "Burned 24H/7D/30D/all-time require a complete transfer index for each window (P2) — Incomplete windows show Unknown / Incomplete.",
  );

  const burnMechanism = classifyBurnMechanism({
    knownBurnedRaw,
    mechanisms,
  });

  const findings = [...mechanisms.findings];
  if (knownBurnedRaw != null && knownBurnedRaw > 0n) {
    findings.push({
      code: "dead_address_inventory",
      severity: "info",
      message:
        "Known burned supply is tokens held at allowlisted dead/burn addresses — totalSupply may be unchanged.",
      source: "rpc",
    });
  }

  return {
    totalSupplyRaw: input.totalSupply?.toString() ?? null,
    totalSupplyFormatted,
    knownBurnedSupplyRaw: knownBurnedRaw?.toString() ?? null,
    knownBurnedSupplyFormatted: dead.knownBurnedFormatted,
    burnedPctOfTotalSupply: dead.burnedPctOfTotalSupply,
    effectiveRemainingSupplyRaw,
    effectiveRemainingSupplyFormatted,
    effectiveRemainingMethod,
    burnMechanism,
    burnFunction: combineBurnFunction(
      mechanisms.holderBurnCallable,
      mechanisms.burnFromPresent,
    ),
    automaticBurn: mechanisms.automaticBurn,
    privilegedBurn: mechanisms.privilegedBurn,
    holderBurnCallable: mechanisms.holderBurnCallable,
    burnFromPresent: mechanisms.burnFromPresent,
    supplyReductionVerified: "unknown",
    deadAddressBalances: dead.balances,
    burnActivity: emptyBurnActivityHistory(
      "Burn activity pending transfer index (P2).",
    ),
    supplyReduction: emptySupplyReductionHistory(
      "Supply reduction pending transfer index / burn-method evidence (P3).",
    ),
    findings,
    dataCompletenessNotes,
  };
}

/**
 * P0 + P1 Supply & Burn Intelligence.
 * Call `enrichSupplyBurnWithHistory` after transfer index for P2/P3.
 */
export async function analyzeSupplyBurnIntelligence(
  input: AnalyzeSupplyBurnInput,
): Promise<SupplyBurnIntelligence> {
  const dead =
    input.deadInventory ??
    (await fetchDeadAddressInventory({
      tokenAddress: input.tokenAddress,
      totalSupply: input.totalSupply,
      decimals: input.decimals,
    }));
  return buildSupplyBurnFromParts({ ...input, deadInventory: dead });
}

/** Sync entry for unit fixtures (pre-supplied dead inventory; no RPC). */
export function analyzeSupplyBurnFromParts(
  input: AnalyzeSupplyBurnInput & {
    deadInventory: Awaited<ReturnType<typeof fetchDeadAddressInventory>>;
  },
): SupplyBurnIntelligence {
  return buildSupplyBurnFromParts(input);
}

export function hasSupplyReducingAbiPath(sb: SupplyBurnIntelligence): boolean {
  return (
    sb.holderBurnCallable === "yes" ||
    sb.burnFromPresent === "yes" ||
    sb.automaticBurn === "yes"
  );
}

/**
 * Attach P2/P3 from the same transfer index used by Creator Behaviour
 * (no extra Blockscout pagination). Persists to `scan:burn:*` for incremental reuse.
 */
export async function enrichSupplyBurnWithHistory(input: {
  supplyBurn: SupplyBurnIntelligence;
  tokenAddress: string;
  transfers: BlockscoutTokenTransferRow[];
  pagesFetched: number;
  paginationComplete: boolean;
  fetchFailed: boolean;
  decimals: number | null;
  /** When false, skip KV persist (unit tests). Default true. */
  persist?: boolean;
  priorStored?: StoredBurnHistory | null;
}): Promise<SupplyBurnIntelligence> {
  const hasPath = hasSupplyReducingAbiPath(input.supplyBurn);
  if (input.persist === false) {
    const bundle = buildBurnHistoryFromTransferIndex({
      address: input.tokenAddress,
      transfers: input.transfers,
      pagesFetched: input.pagesFetched,
      paginationComplete: input.paginationComplete,
      fetchFailed: input.fetchFailed,
      decimals: input.decimals,
      hasSupplyReducingAbiPath: hasPath,
      prior: input.priorStored ?? null,
    });
    return attachBurnHistoryToSupplyBurn(input.supplyBurn, bundle);
  }

  const bundle = await upsertBurnHistoryFromScan({
    address: input.tokenAddress,
    transfers: input.transfers,
    pagesFetched: input.pagesFetched,
    paginationComplete: input.paginationComplete,
    fetchFailed: input.fetchFailed,
    decimals: input.decimals,
    hasSupplyReducingAbiPath: hasPath,
  });
  return attachBurnHistoryToSupplyBurn(input.supplyBurn, bundle);
}
