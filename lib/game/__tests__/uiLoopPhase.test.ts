import { describe, expect, it } from "vitest";
import {
  isResultPhase,
  resultSubstep,
  toUiLoopPhase,
  UI_LOOP_FLOW,
} from "@/lib/game/uiLoopPhase";

describe("uiLoopPhase", () => {
  it("maps wire phases to Choose Location → Battle Result", () => {
    expect(toUiLoopPhase("COMMIT")).toBe("CHOOSE");
    expect(toUiLoopPhase("REVEAL")).toBe("BATTLE");
    expect(toUiLoopPhase("SETTLEMENT")).toBe("BATTLE");
    expect(toUiLoopPhase("CLAIM")).toBe("BATTLE");
    expect([...UI_LOOP_FLOW]).toEqual(["CHOOSE", "BATTLE"]);
  });

  it("derives battle-result substeps (claim is part of viewing, not a wait)", () => {
    expect(resultSubstep("REVEAL")).toBe("preparing");
    expect(resultSubstep("REVEAL", { settled: true })).toBe("battle");
    expect(resultSubstep("SETTLEMENT")).toBe("battle");
    expect(resultSubstep("CLAIM")).toBe("battle");
    expect(isResultPhase("COMMIT")).toBe(false);
    expect(isResultPhase("REVEAL")).toBe(true);
  });
});
