import { describe, expect, it } from "vitest";
import { buildPhaseStatusView, PHASE_FLOW } from "@/lib/game/phaseStatus";
import type { GameDayState } from "@/types/game";

const baseDay = (phase: GameDayState["phase"]): GameDayState => ({
  day: 1,
  phase,
  phaseEndsAt: 1000,
  commitEndsAt: 2000,
  revealEndsAt: 4000,
  settled: phase === "CLAIM",
  settlementStatus: phase === "CLAIM" ? "Complete" : "Pending",
});

describe("buildPhaseStatusView — Commit → Result loop", () => {
  it("marks only Commit active during COMMIT", () => {
    const view = buildPhaseStatusView(baseDay("COMMIT"), "COMMIT");
    expect(view.timeline.map((s) => `${s.id}:${s.state}`)).toEqual([
      "COMMIT:active",
      "RESULT:upcoming",
    ]);
    expect(view.loopPhase).toBe("COMMIT");
    expect(view.nextPhase).toBe("RESULT");
    expect(view.phaseEndsAt).toBe(2000);
    expect(view.settlementAt).toBe(4000);
  });

  it("marks Result active for REVEAL / SETTLEMENT / CLAIM", () => {
    for (const phase of ["REVEAL", "SETTLEMENT", "CLAIM"] as const) {
      const view = buildPhaseStatusView(baseDay(phase), phase);
      expect(view.loopPhase).toBe("RESULT");
      expect(view.timeline.map((s) => `${s.id}:${s.state}`)).toEqual([
        "COMMIT:done",
        "RESULT:active",
      ]);
      expect(view.nextPhase).toBeNull();
    }
  });

  it("keeps PHASE_FLOW as Commit → Result", () => {
    expect([...PHASE_FLOW]).toEqual(["COMMIT", "RESULT"]);
  });
});
