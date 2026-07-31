/**
 * Phase 11E — Hook Position Index public API.
 * Discovery / indexing / completeness only — no valuation or lock claims.
 */

export {
  HOOK_POS_INDEX_SCHEMA_VERSION,
  HOOK_POS_INDEX_SEMANTIC_VERSION,
  HOOK_POS_INDEX_KEY_PREFIX,
  type HookPositionKey,
  type HookPositionRecord,
  type HookPositionIndexState,
  type HookPositionIndexSummary,
  type HookPositionClassification,
  type HookDiscoveryMethod,
  type HookIndexTerminalState,
  type HookIncompleteReason,
  type DecodedModifyLiquidity,
  type RawLogLike,
} from "@/lib/hansome-score/lp/hook-position-index/types";

export {
  MODIFY_LIQUIDITY_TOPIC0,
  DOPPLER_HOOK_INITIALIZER,
  HOOK_POS_POOL_MANAGER,
  HOOK_POS_POSITION_MANAGER,
  DEFAULT_CONFIRMATION_DEPTH,
} from "@/lib/hansome-score/lp/hook-position-index/abis";

export {
  buildHookPosIndexKey,
  buildScopedHookPosIndexKey,
  assertHookPosNamespace,
} from "@/lib/hansome-score/lp/hook-position-index/key";

export {
  ModifyLiquidityDecodeError,
  normalizeBytes32,
  decodeSignedInt24,
  decodeSignedInt256,
  decodeModifyLiquidityLog,
  dedupeModifyLiquidityLogs,
  filterAndDecodeModifyLiquidityLogs,
  positionKeyId,
  topicAddress,
} from "@/lib/hansome-score/lp/hook-position-index/decode";

export {
  classifyHookPositionOwner,
  isZeroLiquidityDelta,
  addNetDelta,
} from "@/lib/hansome-score/lp/hook-position-index/classify";

export {
  HANSOME_TOKEN,
  OKC_TOKEN,
  GME_TOKEN,
  GME_FIXTURE_POSITIONS,
  HOOK_POOL_FIXTURES,
  findHookPoolFixtureByToken,
  findHookPoolFixtureByPoolId,
  isHansomeClassAToken,
  fixtureRecordsFor,
} from "@/lib/hansome-score/lp/hook-position-index/fixtures";

export {
  canTransition,
  transitionTerminalState,
  resolvePublishTerminal,
  bumpGeneration,
  compareGeneration,
} from "@/lib/hansome-score/lp/hook-position-index/state-machine";

export {
  HookPosStoreError,
  clearHookPosStoreMemoryForTests,
  emptyHookPositionIndexState,
  validateHookPositionIndexState,
  loadHookPosIndexMemory,
  saveHookPosIndexMemory,
  upsertHookPosition,
  removePositionsFirstSeenAtOrAfter,
  indexKeyForState,
} from "@/lib/hansome-score/lp/hook-position-index/store";

export {
  bootstrapHookPositionIndex,
  incrementalSyncHookPositionIndex,
  applyFixtureBootstrap,
  type HookPosChainPort,
  type HookSyncOptions,
} from "@/lib/hansome-score/lp/hook-position-index/sync";

export {
  detectHookCheckpointHashMismatch,
  reorgRescanHookPositionIndex,
  simulateReorgRollback,
} from "@/lib/hansome-score/lp/hook-position-index/reorg";

export { buildHookPositionIndexSummary } from "@/lib/hansome-score/lp/hook-position-index/summary";

export { createHookPosChainPort } from "@/lib/hansome-score/lp/hook-position-index/chain-port";

export {
  useHookPosIndexTestKv,
  clearHookPosProductionMemoryForTests,
  hookPosIndexKey,
  loadHookPosIndexProduction,
  saveHookPosIndexProduction,
  withHookPoolLock,
} from "@/lib/hansome-score/lp/hook-position-index/production-kv";

export {
  resolveHookPositionIndex,
  scheduleHookPosIndexBackground,
  clearHookPosBackgroundInflightForTests,
  type HookPosResolveResult,
} from "@/lib/hansome-score/lp/hook-position-index/production";
