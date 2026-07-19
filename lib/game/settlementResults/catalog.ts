/**
 * Standard settlement result SFX catalog (presentation only).
 *
 * Source:  music/<Folder>/
 * Served:  /audio/game/settlement-results/<id>/effect.{ogg,mp3}
 *
 * Replace audio under music/<Folder>/ then:
 *   npm run generate:settlement-result-sfx
 */

export const SETTLEMENT_RESULT_SFX_IDS = [
  "alpaca-hunted",
  "alpaca-safe",
  "cougar-hunt-success",
  "cougar-hunt-failed",
] as const;

export type SettlementResultSfxId = (typeof SETTLEMENT_RESULT_SFX_IDS)[number];

export type SettlementResultSfxDef = {
  id: SettlementResultSfxId;
  /** Source folder under music/ */
  sourceFolder: string;
  /** Public URL folder under /audio/game/settlement-results/ */
  publicFolder: string;
  /** Presentation duration (ms) — VFX + SFX cue window */
  durationMs: number;
  /** Short banner shown with the result VFX */
  banner: string;
};

const CACHE_VER = "settle-result-1";

export const SETTLEMENT_RESULT_SFX_CATALOG: Record<
  SettlementResultSfxId,
  SettlementResultSfxDef
> = {
  "alpaca-hunted": {
    id: "alpaca-hunted",
    sourceFolder: "AlpacaHunted",
    publicFolder: "alpaca-hunted",
    durationMs: 1200,
    banner: "Hunted!",
  },
  "alpaca-safe": {
    id: "alpaca-safe",
    sourceFolder: "AlpacaSafe",
    publicFolder: "alpaca-safe",
    durationMs: 1250,
    banner: "Safe!",
  },
  "cougar-hunt-success": {
    id: "cougar-hunt-success",
    sourceFolder: "CougarHuntSuccess",
    publicFolder: "cougar-hunt-success",
    durationMs: 1300,
    banner: "Hunt Success!",
  },
  "cougar-hunt-failed": {
    id: "cougar-hunt-failed",
    sourceFolder: "CougarHuntFailed",
    publicFolder: "cougar-hunt-failed",
    durationMs: 1350,
    banner: "Hunt Failed",
  },
};

export function settlementResultSfxUrls(
  id: SettlementResultSfxId,
): { ogg: string; mp3: string } {
  const folder = SETTLEMENT_RESULT_SFX_CATALOG[id].publicFolder;
  return {
    ogg: `/audio/game/settlement-results/${folder}/effect.ogg?v=${CACHE_VER}`,
    mp3: `/audio/game/settlement-results/${folder}/effect.mp3?v=${CACHE_VER}`,
  };
}

export function settlementResultPlaybackKey(
  day: number,
  tokenId: number,
  resultId: SettlementResultSfxId,
): string {
  return `${day}:${tokenId}:${resultId}`;
}

/**
 * Map an authoritative settlement outcome string → result SFX id.
 * Returns null for unresolved / non-authoritative labels (esp. live placeholders).
 * Does not invent outcomes from location, rewards, or randomness.
 */
export function parseSettlementResultSfxId(
  outcome: string | null | undefined,
): SettlementResultSfxId | null {
  if (!outcome) return null;
  const o = outcome.trim().toLowerCase();
  if (!o || o === "—" || o === "-") return null;

  // Live / unresolved / E9 missed-reveal — never invent a result cue.
  if (
    o.includes("settled on-chain") ||
    o.includes("awaiting") ||
    o.includes("not exposed") ||
    o === "participated" ||
    o === "missed_reveal" ||
    o.includes("missed today's reveal") ||
    o.includes("missed reveal")
  ) {
    return null;
  }

  // Cougar hunt results (check before generic "hunt" in alpaca escaped strings)
  if (o.includes("hunt success")) return "cougar-hunt-success";
  if (
    o.includes("hunt miss") ||
    o.includes("hunt fail") ||
    o.includes("hunt failed")
  ) {
    return "cougar-hunt-failed";
  }

  // Alpaca hunted (penalty) — match "hunted", not merely "hunt"
  if (o.includes("hunted")) return "alpaca-hunted";

  // Alpaca safe / survived / escaped
  if (o.includes("safe") || o.includes("survived") || o.includes("escaped")) {
    return "alpaca-safe";
  }

  return null;
}
