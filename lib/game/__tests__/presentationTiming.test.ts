import { describe, expect, it } from "vitest";
import {
  BATTLE_PRESENTATION_DURATION_MULTIPLIER,
  PRESENTATION_BASELINE_SCALE,
  PRESENTATION_DURATION_SCALE,
  PRESENTATION_FAILSAFE_MS,
  PRESENTATION_INTER_CUE_GAP_MS,
  PRESENTATION_REDUCED_MOTION_MS,
  REWARD_COUNT_UP_MIN_MS,
  REWARD_REVEAL_FALLBACK_MS,
  SETTLEMENT_CARD_ENTER_MS,
  SETTLEMENT_CARD_STAGGER_MS,
  battlePresentationMs,
  battlePresentationSeconds,
  scalePresentationMs,
} from "@/lib/game/presentationTiming";
import { SETTLEMENT_RESULT_SFX_CATALOG } from "@/lib/game/settlementResults/catalog";
import { ABILITY_EFFECT_CATALOG } from "@/lib/game/abilityEffects/catalog";

describe("presentationTiming — 2× Battle Result presentation", () => {
  it("battlePresentationMs doubles a base visual delay (500 → 1000)", () => {
    expect(BATTLE_PRESENTATION_DURATION_MULTIPLIER).toBe(2);
    expect(battlePresentationMs(500)).toBe(1000);
    expect(battlePresentationSeconds(1.8)).toBe(3.6);
  });

  it("scales Season-1 baseline cues through baseline × multiplier", () => {
    expect(PRESENTATION_BASELINE_SCALE).toBe(1.5);
    expect(PRESENTATION_DURATION_SCALE).toBe(3);
    // Previous UX (1.5×): 1200 → 1800; now 2× that → 3600
    expect(scalePresentationMs(1200)).toBe(3600);
    expect(SETTLEMENT_RESULT_SFX_CATALOG["alpaca-safe"].durationMs).toBe(3750);
    expect(ABILITY_EFFECT_CATALOG.king.durationMs).toBe(4200);
  });

  it("doubles inter-cue gap, card stagger, enter, and failsafe", () => {
    expect(PRESENTATION_INTER_CUE_GAP_MS).toBe(450);
    expect(SETTLEMENT_CARD_STAGGER_MS).toBe(210);
    expect(SETTLEMENT_CARD_ENTER_MS).toBe(1360);
    expect(REWARD_COUNT_UP_MIN_MS).toBe(800);
    expect(REWARD_REVEAL_FALLBACK_MS).toBe(3600);
    expect(PRESENTATION_FAILSAFE_MS).toBe(180_000);
  });

  it("keeps reduced-motion hold unscaled", () => {
    expect(PRESENTATION_REDUCED_MOTION_MS).toBe(900);
  });

  it("approximately doubles total cue+gap duration for a one-NFT result", () => {
    const cue = SETTLEMENT_RESULT_SFX_CATALOG["alpaca-safe"].durationMs;
    const gap = PRESENTATION_INTER_CUE_GAP_MS;
    const total = cue + gap;
    // Previous: 1875 + 225 = 2100; doubled ≈ 4200
    expect(total).toBe(3750 + 450);
    expect(total).toBe(4200);
  });
});

describe("presentationTiming — non-visual timings unchanged", () => {
  it("does not export polling or relayer retry constants", async () => {
    const mod = await import("@/lib/game/presentationTiming");
    expect(mod).not.toHaveProperty("POLL_INTERVAL_MS");
    expect(mod).not.toHaveProperty("RELAYER_RETRY_MS");
    expect(mod).not.toHaveProperty("SETTLEMENT_API_TIMEOUT_MS");
  });

  it("leaves gasless coordinator poll intervals untouched", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("lib/game/testnetResolveCoordinator.ts", "utf8"),
    );
    expect(src).toMatch(/const FAST_POLL_MS = 1_500;/);
    expect(src).toMatch(/const SLOW_POLL_MS = 6_000;/);
  });
});
