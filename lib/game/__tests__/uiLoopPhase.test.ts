import { describe, expect, it } from "vitest";
import {
  enterGameHref,
  isResultPhase,
  resultSubstep,
  toUiLoopPhase,
  UI_LOOP_FLOW,
} from "@/lib/game/uiLoopPhase";

const HREFS = { commit: "/game/commit", result: "/game/result" };

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

  it("routes ENTER THE GAME to the current gameplay surface", () => {
    expect(enterGameHref("COMMIT", HREFS)).toBe("/game/commit");
    expect(enterGameHref("REVEAL", HREFS)).toBe("/game/result");
    expect(enterGameHref("SETTLEMENT", HREFS)).toBe("/game/result");
    // Settled but battle viewing window still open (wire CLAIM).
    expect(enterGameHref("CLAIM", HREFS)).toBe("/game/result");
  });
});
