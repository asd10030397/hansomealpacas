/**
 * Ensure each settlement ability result plays its presentation at most once.
 */

import { hasPlayedSfxOnce, markSfxPlayedOnce } from "@/lib/game/sfxOnce";
import { abilityPlaybackKey, type AbilityEffectId } from "./catalog";

const PREFIX = "hansome-ability-fx:";

export function hasPlayedAbilityEffect(
  day: number,
  tokenId: number,
  abilityId: AbilityEffectId,
): boolean {
  return hasPlayedSfxOnce(PREFIX, abilityPlaybackKey(day, tokenId, abilityId));
}

export function markAbilityEffectPlayed(
  day: number,
  tokenId: number,
  abilityId: AbilityEffectId,
): void {
  markSfxPlayedOnce(PREFIX, abilityPlaybackKey(day, tokenId, abilityId));
}
