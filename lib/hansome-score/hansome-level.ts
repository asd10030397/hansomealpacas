import type {
  ActivityLevel,
  HansomeLevelId,
  HansomeLevelResult,
} from "@/lib/hansome-score/types";

/**
 * Presentation-only HANSOME Level.
 * Maps raw Activity labels → branded meme display. Never feeds Score / Overall /
 * Confidence / risk deductions.
 */

/** Engine levels today + reserved future raw labels. */
export type RawActivityLevel =
  | ActivityLevel
  | "Very Low"
  | "Inactive"
  | "Very High";

export type { HansomeLevelId, HansomeLevelResult };

const BRANDED: Record<
  HansomeLevelId,
  Omit<HansomeLevelResult, "rawLevel">
> = {
  not_hansome: {
    id: "not_hansome",
    label: "NOT HANSOME",
    emoji: "💀",
  },
  kinda_hansome: {
    id: "kinda_hansome",
    label: "KINDA HANSOME",
    emoji: "😐",
  },
  hansome: {
    id: "hansome",
    label: "HANSOME",
    emoji: "🦙",
  },
  very_hansome: {
    id: "very_hansome",
    label: "VERY HANSOME",
    emoji: "😎",
  },
  too_hansome: {
    id: "too_hansome",
    label: "TOO HANSOME",
    emoji: "🔥",
  },
};

/** Full five-level presentation catalog (for UI / Explore planning). */
export const HANSOME_LEVEL_CATALOG: readonly HansomeLevelResult[] = (
  Object.keys(BRANDED) as HansomeLevelId[]
).map((id) => ({
  ...BRANDED[id],
  rawLevel: "",
}));

function normalizeRawLevel(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_-]+/g, " ");
}

/**
 * Map raw Activity → branded HANSOME Level.
 * Unknown / empty values fall back to NOT HANSOME (safest inactive presentation).
 */
export function toHansomeLevel(rawLevel: string | null | undefined): HansomeLevelResult {
  const key = normalizeRawLevel(rawLevel ?? "");

  let id: HansomeLevelId;
  switch (key) {
    case "very low":
    case "inactive":
      id = "not_hansome";
      break;
    case "low":
      id = "kinda_hansome";
      break;
    case "medium":
    case "med":
      id = "hansome";
      break;
    case "high":
      id = "very_hansome";
      break;
    case "very high":
      id = "too_hansome";
      break;
    default:
      id = "not_hansome";
      break;
  }

  return {
    ...BRANDED[id],
    rawLevel: rawLevel?.trim() || "Inactive",
  };
}

/** Convenience for engine ActivityResult.level. */
export function hansomeLevelFromActivity(level: ActivityLevel): HansomeLevelResult {
  return toHansomeLevel(level);
}
