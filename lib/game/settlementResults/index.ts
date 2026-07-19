export {
  SETTLEMENT_RESULT_SFX_CATALOG,
  SETTLEMENT_RESULT_SFX_IDS,
  parseSettlementResultSfxId,
  settlementResultPlaybackKey,
  settlementResultSfxUrls,
  type SettlementResultSfxDef,
  type SettlementResultSfxId,
} from "./catalog";
// Result VFX lives in components/game/result-effects (presentation only).
export { playSettlementResultSfx } from "./audio";
export {
  hasPlayedSettlementResultSfx,
  markSettlementResultSfxPlayed,
} from "./playback";
