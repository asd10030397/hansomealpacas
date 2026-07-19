import { describe, expect, it } from "vitest";
import {
  PRESENTATION_DURATION_SCALE,
  PRESENTATION_INTER_CUE_GAP_MS,
  SETTLEMENT_CARD_STAGGER_MS,
  scalePresentationMs,
} from "@/lib/game/presentationTiming";
import { SETTLEMENT_RESULT_SFX_CATALOG } from "@/lib/game/settlementResults/catalog";
import { ABILITY_EFFECT_CATALOG } from "@/lib/game/abilityEffects/catalog";

describe("presentationTiming", () => {
  it("scales cue durations by ~50%", () => {
    expect(PRESENTATION_DURATION_SCALE).toBe(1.5);
    expect(scalePresentationMs(1200)).toBe(1800);
    expect(SETTLEMENT_RESULT_SFX_CATALOG["alpaca-safe"].durationMs).toBe(1875);
    expect(ABILITY_EFFECT_CATALOG.king.durationMs).toBe(2100);
  });

  it("keeps inter-cue gap and card stagger slower for sequential readability", () => {
    expect(PRESENTATION_INTER_CUE_GAP_MS).toBeGreaterThanOrEqual(200);
    expect(SETTLEMENT_CARD_STAGGER_MS).toBe(105);
  });
});
