import { describe, expect, it } from "vitest";
import { buildPhaseStatusView, PHASE_FLOW } from "@/lib/game/phaseStatus";
import type { GameDayState } from "@/types/game";

const baseDay = (phase: GameDayState["phase"]): GameDayState => ({
  day: 1,
  phase,
  phaseEndsAt: 1000,
  commitEndsAt: 2000,
  revealEndsAt: 4000,
  dayEndsAt: 6000,
  settled: phase === "CLAIM",
  settlementStatus: phase === "CLAIM" ? "Complete" : "Pending",
});

describe("buildPhaseStatusView — Choose → Battle Result", () => {
  it("marks Choose active during COMMIT", () => {
    const view = buildPhaseStatusView(baseDay("COMMIT"), "COMMIT");
    expect(view.timeline.map((s) => `${s.id}:${s.state}`)).toEqual([
      "CHOOSE:active",
      "BATTLE:upcoming",
    ]);
    expect(view.loopPhase).toBe("CHOOSE");
    expect(view.nextPhase).toBe("BATTLE");
  });

  it("collapses REVEAL, SETTLEMENT, and CLAIM into Battle Result", () => {
    for (const phase of ["REVEAL", "SETTLEMENT", "CLAIM"] as const) {
      const view = buildPhaseStatusView(baseDay(phase), phase);
      expect(view.loopPhase).toBe("BATTLE");
      expect(view.timeline.map((s) => `${s.id}:${s.state}`)).toEqual([
        "CHOOSE:done",
        "BATTLE:active",
      ]);
    }
  });

  it("keeps PHASE_FLOW as Choose → Battle", () => {
    expect([...PHASE_FLOW]).toEqual(["CHOOSE", "BATTLE"]);
  });
});
