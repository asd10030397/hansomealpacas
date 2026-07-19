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

export const ABILITY_EFFECT_IDS = [
  "guardian",
  "runner",
  "lucky",
  "farmer",
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

const CACHE_VER = "ability-1";

export const ABILITY_EFFECT_CATALOG: Record<AbilityEffectId, AbilityEffectDef> = {
  guardian: {
    id: "guardian",
    sourceFolder: "Guardian",
    publicFolder: "guardian",
    banner: "Guardian Shield Activated!",
    durationMs: 1200,
  },
  runner: {
    id: "runner",
    sourceFolder: "Runner",
    publicFolder: "runner",
    banner: "Runner Escaped!",
    durationMs: 1200,
  },
  lucky: {
    id: "lucky",
    sourceFolder: "Lucky",
    publicFolder: "lucky",
    banner: "Lucky Triggered!",
    durationMs: 1300,
  },
  farmer: {
    id: "farmer",
    sourceFolder: "Farmer",
    publicFolder: "farmer",
    banner: "Harvest Bonus!",
    durationMs: 1400,
  },
};

export function abilitySfxUrls(id: AbilityEffectId): { ogg: string; mp3: string } {
  const folder = ABILITY_EFFECT_CATALOG[id].publicFolder;
  return {
    ogg: `/audio/game/abilities/${folder}/effect.ogg?v=${CACHE_VER}`,
    mp3: `/audio/game/abilities/${folder}/effect.mp3?v=${CACHE_VER}`,
  };
}

/** Map gameplay class / ability label → presentation id (null if none). */
export function parseAbilityEffectId(
  ability: string | null | undefined,
): AbilityEffectId | null {
  if (!ability) return null;
  const s = ability.toLowerCase();
  if (s.includes("guardian")) return "guardian";
  if (s.includes("runner")) return "runner";
  if (s.includes("lucky")) return "lucky";
  if (s.includes("farmer") || s.includes("harvest")) return "farmer";
  return null;
}

export function abilityPlaybackKey(
  day: number,
  tokenId: number,
  abilityId: AbilityEffectId,
): string {
  return `${day}:${tokenId}:${abilityId}`;
}
