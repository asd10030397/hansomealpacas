export type TriState = "yes" | "no" | "unknown";

export type BurnAddressBalance = {
  address: string;
  label: "burn_dead";
  balanceRaw: string;
  balanceFormatted: string | null;
  percentOfTotalSupply: number | null;
};

export type BurnMechanism =
  | "none_detected"
  | "dead_address_only"
  | "supply_reducing_burn"
  | "holder_burn"
  | "burn_from"
  | "automatic_transfer_burn"
  | "privileged_burn"
  | "mixed"
  | "unknown";

export type EffectiveRemainingMethod =
  | "total_minus_known_dead"
  | "current_total_supply_only"
  | "unavailable";

export type SupplyBurnFinding = {
  code: string;
  severity: "info" | "warning" | "risk";
  message: string;
  source: "rpc" | "abi_source" | "provisional" | "transfer_index";
};

/** Window completeness for P2 dead-address burn inflows. */
export type BurnWindowCompleteness =
  | "complete"
  | "incomplete"
  | "unknown";

export type BurnActivityWindowId = "24h" | "7d" | "30d" | "all";

/**
 * P2 time-windowed burn inflow to allowlisted dead addresses.
 * Amount is null whenever the window is not complete — never silent partial-as-full.
 */
export type BurnActivityWindow = {
  window: BurnActivityWindowId;
  burnedToDeadRaw: string | null;
  burnedToDeadFormatted: string | null;
  completeness: BurnWindowCompleteness;
  note: string;
};

/** Historical supply-reduction evidence status (P3) — separate from dead inventory. */
export type HistoricalReductionStatus = "verified" | "partial" | "unknown";

export type BurnActivityHistory = {
  /** ISO timestamp of most recent allowlisted dead inflow when reliable; else null. */
  lastBurnAt: string | null;
  /** Reliable only when all-time transfer index is complete. */
  burnTransactionCount: number | null;
  windows: BurnActivityWindow[];
  /**
   * True when the transfer head was successfully indexed (newest-first API).
   * Last-burn may be reliable even if all-time is incomplete.
   */
  headIndexed: boolean;
  pagesFetched: number;
  transfersIndexed: number;
  paginationComplete: boolean;
  fetchFailed: boolean;
  /** Source of this history blob (scan transfer index vs burn cache). */
  source: "transfer_index" | "burn_cache" | "none";
};

export type SupplyReductionHistory = {
  /**
   * Cumulative raw amount of transfers classified as supply-reducing burns.
   * null when status is unknown (do not show 0 as proven).
   */
  provenSupplyReductionRaw: string | null;
  provenSupplyReductionFormatted: string | null;
  historicalReductionStatus: HistoricalReductionStatus;
  /** Count of classified supply-reducing burn txs when status ≠ unknown. */
  provenBurnEventCount: number | null;
  note: string;
};

/**
 * Supply & Burn Intelligence (P0 + P1 + P2 + P3).
 * P2/P3 are informational only — never boost Structural / Overall Score.
 */
export type SupplyBurnIntelligence = {
  totalSupplyRaw: string | null;
  totalSupplyFormatted: string | null;
  knownBurnedSupplyRaw: string | null;
  knownBurnedSupplyFormatted: string | null;
  burnedPctOfTotalSupply: number | null;
  effectiveRemainingSupplyRaw: string | null;
  effectiveRemainingSupplyFormatted: string | null;
  effectiveRemainingMethod: EffectiveRemainingMethod;
  burnMechanism: BurnMechanism;
  /**
   * Primary UI: Yes if holder `burn()` and/or `burnFrom()` present.
   * Capability ≠ already burned. Split details stay in Advanced.
   */
  burnFunction: TriState;
  automaticBurn: TriState;
  /** Admin / privileged burn of arbitrary holders (Contract Risk when yes). */
  privilegedBurn: TriState;
  holderBurnCallable: TriState;
  burnFromPresent: TriState;
  /**
   * Legacy tri-state derived from P3:
   * yes = verified & proven > 0; no = verified & proven = 0; else unknown.
   * Dead-address inventory alone never sets yes.
   */
  supplyReductionVerified: TriState;
  deadAddressBalances: BurnAddressBalance[];
  /** P2 — dead-address burn inflow windows. */
  burnActivity: BurnActivityHistory;
  /** P3 — proven totalSupply reduction (not inferred from dead balances). */
  supplyReduction: SupplyReductionHistory;
  findings: SupplyBurnFinding[];
  dataCompletenessNotes: string[];
};

export type AbiItem = {
  type?: string;
  name?: string;
  stateMutability?: string;
  inputs?: { name?: string; type?: string }[];
};

export type BurnMechanismDetection = {
  holderBurnCallable: TriState;
  burnFromPresent: TriState;
  automaticBurn: TriState;
  privilegedBurn: TriState;
  findings: SupplyBurnFinding[];
  notes: string[];
};

/** Compact burn inflow event stored in burn history cache. */
export type BurnInflowEvent = {
  timestamp: string | null;
  timestampMs: number | null;
  valueRaw: string;
  txHash: string | null;
  to: string;
  from: string;
  method: string | null;
  /** true when classified as supply-reducing (P3), not merely dead inventory. */
  supplyReducing: boolean;
};
