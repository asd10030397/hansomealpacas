/**
 * Season 1 special-ability presentation catalog.
 * Presentation only — not gameplay balance or contract logic.
 *
 * Audio convention:
 *   source:  music/<Folder>/   (any audio file; first wins when encoding)
 *   served:  /audio/game/abilities/<id>/effect.{ogg,mp3}
 *
 * Replace or add sound files under music/<Folder>/ then run:
 *   npm run generate:ability-sfx
 */

import { scalePresentationMs } from "@/lib/game/presentationTiming";

export const ABILITY_EFFECT_IDS = [
  "guardian",
  "runner",
  "lucky",
  "farmer",
  "king",
] as const;

export type AbilityEffectId = (typeof ABILITY_EFFECT_IDS)[number];

export type AbilityEffectDef = {
  id: AbilityEffectId;
  /** Source folder under music/ */
  sourceFolder: string;
  /** Public URL folder under /audio/game/abilities/ */
  publicFolder: string;
  banner: string;
  /** Target presentation duration (ms) */
  durationMs: number;
};

const CACHE_VER = "ability-3";

export const ABILITY_EFFECT_CATALOG: Record<AbilityEffectId, AbilityEffectDef> = {
  guardian: {
    id: "guardian",
    sourceFolder: "Guardian",
    publicFolder: "guardian",
    banner: "Guardian activated!",
    durationMs: scalePresentationMs(1200),
  },
  runner: {
    id: "runner",
    sourceFolder: "Runner",
    publicFolder: "runner",
    banner: "Runner activated!",
    durationMs: scalePresentationMs(1200),
  },
  lucky: {
    id: "lucky",
    sourceFolder: "Lucky",
    publicFolder: "lucky",
    banner: "Lucky activated!",
    durationMs: scalePresentationMs(1300),
  },
  farmer: {
    id: "farmer",
    sourceFolder: "Farmer",
    publicFolder: "farmer",
    /** Passive identity — settlement does not treat Farmer as a temporary proc. */
    banner: "Farmer · Harvest Boost",
    durationMs: scalePresentationMs(1400),
  },
  king: {
    id: "king",
    /** Source masters: music/king/ (see generate-ability-sfx.mjs). */
    sourceFolder: "king",
    publicFolder: "king",
    banner: "King activated!",
    durationMs: scalePresentationMs(1400),
  },
};

export function abilitySfxUrls(id: AbilityEffectId): { ogg: string; mp3: string } {
  const folder = ABILITY_EFFECT_CATALOG[id].publicFolder;
  return {
    ogg: `/audio/game/abilities/${folder}/effect.ogg?v=${CACHE_VER}`,
    mp3: `/audio/game/abilities/${folder}/effect.mp3?v=${CACHE_VER}`,
  };
}

/**
 * Map an *activation* label → presentation id.
 * Intentionally does NOT match static inventory class fluff
 * ("Lucky Escape", "Harvest Boost", "Sprint Escape", "Guard", "Royal Immunity").
 */
export function parseAbilityEffectId(
  ability: string | null | undefined,
): AbilityEffectId | null {
  if (!ability) return null;
  const s = ability.toLowerCase().trim();
  if (!s || s === "—" || s === "-") return null;

  const activated = s.includes("activated");
  const mockDash = s.includes("—") || s.includes(" - ");

  if (!activated && !mockDash) return null;

  if (s.includes("guardian")) return "guardian";
  if (s.includes("runner")) return "runner";
  if (s.includes("lucky")) return "lucky";
  // Farmer passive identity is card-only — do not treat as a proc cue.
  if (s.includes("farmer") && activated) return "farmer";
  if (s.includes("king")) return "king";
  return null;
}

export function abilityPlaybackKey(
  day: number,
  tokenId: number,
  abilityId: AbilityEffectId,
): string {
  return `${day}:${tokenId}:${abilityId}`;
}
