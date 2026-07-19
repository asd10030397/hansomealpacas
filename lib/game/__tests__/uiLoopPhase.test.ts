import { describe, expect, it } from "vitest";
import {
  isResultPhase,
  resultSubstep,
  toUiLoopPhase,
  UI_LOOP_FLOW,
} from "@/lib/game/uiLoopPhase";

describe("uiLoopPhase", () => {
  it("maps wire phases to Commit → Reveal → Battle → Claim", () => {
    expect(toUiLoopPhase("COMMIT")).toBe("COMMIT");
    expect(toUiLoopPhase("REVEAL")).toBe("REVEAL");
    expect(toUiLoopPhase("SETTLEMENT")).toBe("BATTLE");
    expect(toUiLoopPhase("CLAIM")).toBe("CLAIM");
    expect([...UI_LOOP_FLOW]).toEqual(["COMMIT", "REVEAL", "BATTLE", "CLAIM"]);
  });

  it("derives result substeps without auto-reveal", () => {
    expect(resultSubstep("REVEAL")).toBe("reveal");
    expect(resultSubstep("SETTLEMENT")).toBe("battle");
    expect(resultSubstep("CLAIM")).toBe("claim");
    expect(isResultPhase("COMMIT")).toBe(false);
    expect(isResultPhase("REVEAL")).toBe(true);
  });
});
