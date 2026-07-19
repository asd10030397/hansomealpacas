import { describe, expect, it } from "vitest";
import {
  isResultPhase,
  resultSubstep,
  toUiLoopPhase,
} from "@/lib/game/uiLoopPhase";

describe("uiLoopPhase", () => {
  it("maps wire phases to Commit | Result", () => {
    expect(toUiLoopPhase("COMMIT")).toBe("COMMIT");
    expect(toUiLoopPhase("REVEAL")).toBe("RESULT");
    expect(toUiLoopPhase("SETTLEMENT")).toBe("RESULT");
    expect(toUiLoopPhase("CLAIM")).toBe("RESULT");
  });

  it("derives result substeps without auto-reveal", () => {
    expect(resultSubstep("REVEAL")).toBe("reveal");
    expect(resultSubstep("SETTLEMENT")).toBe("settle");
    expect(resultSubstep("CLAIM")).toBe("claim");
    expect(isResultPhase("COMMIT")).toBe(false);
    expect(isResultPhase("REVEAL")).toBe(true);
  });
});
