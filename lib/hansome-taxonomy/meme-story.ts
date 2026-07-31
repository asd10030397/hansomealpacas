import type { MemeStoryTier } from "@/lib/hansome-taxonomy/types";

/** Exact Unknown copy — docs/HANSOME_MEME_STORY_SPEC.md §2 */
export const MEME_STORY_UNKNOWN_COPY =
  "No verified background story is currently available.";

export const MEME_STORY_TIER_LABELS: Record<MemeStoryTier, string> = {
  verified: "Verified Project Description",
  community_public: "Community / Public Background",
  unknown: "Unknown",
};

export function memeStoryTierLabel(tier: MemeStoryTier): string {
  return MEME_STORY_TIER_LABELS[tier];
}

/**
 * Display text for UI / Scan Context. Never invent lore when missing.
 */
export function resolveMemeStoryDisplayText(
  tier: MemeStoryTier,
  text: string | null | undefined,
): string {
  if (tier === "unknown" || text == null || text.trim() === "") {
    return MEME_STORY_UNKNOWN_COPY;
  }
  return text.trim();
}

/** Soft length hint: 2–4 sentences; reject empty verified submissions. */
export function assertMemeStoryTextAcceptable(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Meme Story text must not be empty");
  }
  if (trimmed.length > 1200) {
    throw new Error("Meme Story text exceeds 1200 characters");
  }
  return trimmed;
}
