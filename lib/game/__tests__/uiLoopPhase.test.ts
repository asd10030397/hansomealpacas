import { describe, expect, it } from "vitest";
import {
  isResultPhase,
  resultSubstep,
  toUiLoopPhase,
  UI_LOOP_FLOW,
} from "@/lib/game/uiLoopPhase";

describe("uiLoopPhase — Choose Location → Battle Result → Claim", () => {
  it("maps wire phases to the three player-facing steps", () => {
    expect(toUiLoopPhase("COMMIT")).toBe("CHOOSE");
    expect(toUiLoopPhase("REVEAL")).toBe("BATTLE");
    expect(toUiLoopPhase("SETTLEMENT")).toBe("BATTLE");
    expect(toUiLoopPhase("CLAIM")).toBe("CLAIM");
    expect([...UI_LOOP_FLOW]).toEqual(["CHOOSE", "BATTLE", "CLAIM"]);
  });

  it("derives battle-result substeps (reveal is preparing, not a player action)", () => {
    expect(resultSubstep("REVEAL")).toBe("preparing");
    expect(resultSubstep("SETTLEMENT")).toBe("battle");
    expect(resultSubstep("CLAIM")).toBe("claim");
    expect(isResultPhase("COMMIT")).toBe(false);
    expect(isResultPhase("REVEAL")).toBe(true);
  });
});
