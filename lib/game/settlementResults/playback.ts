import { hasPlayedSfxOnce, markSfxPlayedOnce } from "@/lib/game/sfxOnce";
import {
  settlementResultPlaybackKey,
  type SettlementResultSfxId,
} from "./catalog";

const PREFIX = "hansome-settlement-result-sfx:";

export function hasPlayedSettlementResultSfx(
  day: number,
  tokenId: number,
  resultId: SettlementResultSfxId,
): boolean {
  return hasPlayedSfxOnce(PREFIX, settlementResultPlaybackKey(day, tokenId, resultId));
}

export function markSettlementResultSfxPlayed(
  day: number,
  tokenId: number,
  resultId: SettlementResultSfxId,
): void {
  markSfxPlayedOnce(PREFIX, settlementResultPlaybackKey(day, tokenId, resultId));
}
