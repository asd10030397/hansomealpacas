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

describe("buildPhaseStatusView", () => {
  it("marks only Commit active during COMMIT", () => {
    const view = buildPhaseStatusView(baseDay("COMMIT"), "COMMIT");
    expect(view.timeline.map((s) => s.state)).toEqual([
      "active",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(view.nextPhase).toBe("REVEAL");
    expect(view.phaseEndsAt).toBe(2000);
    expect(view.settlementAt).toBe(4000);
  });

  it("marks Commit done and Reveal active during REVEAL", () => {
    const view = buildPhaseStatusView(baseDay("REVEAL"), "REVEAL");
    expect(view.timeline.map((s) => `${s.id}:${s.state}`)).toEqual([
      "COMMIT:done",
      "REVEAL:active",
      "SETTLEMENT:upcoming",
      "CLAIM:upcoming",
    ]);
    expect(view.nextPhase).toBe("SETTLEMENT");
  });

  it("keeps PHASE_FLOW order stable", () => {
    expect([...PHASE_FLOW]).toEqual(["COMMIT", "REVEAL", "SETTLEMENT", "CLAIM"]);
  });
});
