export {
  analyzeSupplyBurnIntelligence,
  analyzeSupplyBurnFromParts,
  enrichSupplyBurnWithHistory,
  hasSupplyReducingAbiPath,
} from "@/lib/hansome-score/supply-burn/analyze";
export {
  detectBurnMechanisms,
  classifyBurnMechanism,
  combineBurnFunction,
  stripSolidityNoise,
} from "@/lib/hansome-score/supply-burn/mechanisms";
export {
  fetchDeadAddressInventory,
  aggregateKnownBurned,
  allowlistedBurnAddresses,
} from "@/lib/hansome-score/supply-burn/dead-inventory";
export {
  computeBurnActivityHistory,
  computeSupplyReductionHistory,
  extractBurnEventsFromTransfers,
  isAllowlistedBurnAddress,
  isProvenSupplyReducingTransfer,
  isSupplyReducingBurnMethod,
  windowCompleteness,
  emptyBurnActivityHistory,
  emptySupplyReductionHistory,
  mergeBurnEvents,
  supplyReductionTriState,
} from "@/lib/hansome-score/supply-burn/burn-history";
export {
  upsertBurnHistoryFromScan,
  buildBurnHistoryFromTransferIndex,
  attachBurnHistoryToSupplyBurn,
  peekBurnHistoryBundle,
  scheduleBurnHistoryBackgroundRefresh,
  loadBurnHistory,
  persistBurnHistory,
  refreshBurnHistoryIncremental,
  isBurnHistoryFresh,
  BURN_HISTORY_TTL_MS,
  BURN_HISTORY_STALE_TTL_MS,
} from "@/lib/hansome-score/supply-burn/burn-cache";
export {
  BURN_EXPLAINABILITY_TOOLTIP_KEYS,
  isValidKnownBurnedVsBurnFunctionState,
  burnTriStateTone,
  burnTriStateClassName,
  formatBurnedPctForDisplay,
  isNonNegativeRemainingSupply,
  knownBurnedWithinTotalSupply,
} from "@/lib/hansome-score/supply-burn/presentation";
export type { BurnExplainabilityTooltipKey } from "@/lib/hansome-score/supply-burn/presentation";
export type {
  SupplyBurnIntelligence,
  BurnMechanism,
  BurnAddressBalance,
  BurnMechanismDetection,
  TriState,
  EffectiveRemainingMethod,
  SupplyBurnFinding,
  AbiItem,
  BurnActivityHistory,
  BurnActivityWindow,
  BurnActivityWindowId,
  BurnWindowCompleteness,
  SupplyReductionHistory,
  HistoricalReductionStatus,
  BurnInflowEvent,
} from "@/lib/hansome-score/supply-burn/types";
