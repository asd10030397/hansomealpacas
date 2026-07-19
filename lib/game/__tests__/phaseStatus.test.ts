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

describe("buildPhaseStatusView — Commit → Reveal → Battle → Claim", () => {
  it("marks only Commit active during COMMIT", () => {
    const view = buildPhaseStatusView(baseDay("COMMIT"), "COMMIT");
    expect(view.timeline.map((s) => `${s.id}:${s.state}`)).toEqual([
      "COMMIT:active",
      "REVEAL:upcoming",
      "BATTLE:upcoming",
      "CLAIM:upcoming",
    ]);
    expect(view.loopPhase).toBe("COMMIT");
    expect(view.nextPhase).toBe("REVEAL");
    expect(view.phaseEndsAt).toBe(2000);
    expect(view.settlementAt).toBe(4000);
  });

  it("marks Reveal active during REVEAL", () => {
    const view = buildPhaseStatusView(baseDay("REVEAL"), "REVEAL");
    expect(view.loopPhase).toBe("REVEAL");
    expect(view.timeline.map((s) => `${s.id}:${s.state}`)).toEqual([
      "COMMIT:done",
      "REVEAL:active",
      "BATTLE:upcoming",
      "CLAIM:upcoming",
    ]);
    expect(view.nextPhase).toBe("BATTLE");
    expect(view.phaseEndsAt).toBe(4000);
  });

  it("maps SETTLEMENT to Battle with dayEndsAt countdown", () => {
    const view = buildPhaseStatusView(baseDay("SETTLEMENT"), "SETTLEMENT");
    expect(view.loopPhase).toBe("BATTLE");
    expect(view.timeline.map((s) => `${s.id}:${s.state}`)).toEqual([
      "COMMIT:done",
      "REVEAL:done",
      "BATTLE:active",
      "CLAIM:upcoming",
    ]);
    expect(view.nextPhase).toBe("CLAIM");
    expect(view.phaseEndsAt).toBe(6000);
  });

  it("marks Claim active when settled", () => {
    const view = buildPhaseStatusView(baseDay("CLAIM"), "CLAIM");
    expect(view.loopPhase).toBe("CLAIM");
    expect(view.timeline.map((s) => `${s.id}:${s.state}`)).toEqual([
      "COMMIT:done",
      "REVEAL:done",
      "BATTLE:done",
      "CLAIM:active",
    ]);
    expect(view.nextPhase).toBeNull();
  });

  it("keeps PHASE_FLOW as Commit → Reveal → Battle → Claim", () => {
    expect([...PHASE_FLOW]).toEqual(["COMMIT", "REVEAL", "BATTLE", "CLAIM"]);
  });
});
