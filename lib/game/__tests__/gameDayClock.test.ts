import { describe, expect, it } from "vitest";
import {
  computeDayIndex,
  derivePhaseFromWindows,
} from "@/hooks/game/useGameState";

describe("game day clock", () => {
  const dayZero = 1_000_000;
  const dayLen = 360;
  const commit = 120;
  const reveal = 120;

  it("matches on-chain currentDay division", () => {
    expect(computeDayIndex(dayZero, dayLen, (dayZero + 0) * 1000)).toBe(0);
    expect(computeDayIndex(dayZero, dayLen, (dayZero + 359) * 1000)).toBe(0);
    expect(computeDayIndex(dayZero, dayLen, (dayZero + 360) * 1000)).toBe(1);
    expect(computeDayIndex(dayZero, dayLen, (dayZero + 720) * 1000)).toBe(2);
  });

  it("maps Commit → Reveal → Battle → Claim windows", () => {
    const start = dayZero;
    const commitEndsAt = (start + commit) * 1000;
    const revealEndsAt = (start + commit + reveal) * 1000;
    const dayEndsAt = (start + dayLen) * 1000;

    expect(
      derivePhaseFromWindows({
        nowMs: commitEndsAt - 1,
        commitEndsAt,
        revealEndsAt,
        settled: false,
      }),
    ).toBe("COMMIT");

    expect(
      derivePhaseFromWindows({
        nowMs: commitEndsAt,
        commitEndsAt,
        revealEndsAt,
        settled: false,
      }),
    ).toBe("REVEAL");

    expect(
      derivePhaseFromWindows({
        nowMs: revealEndsAt,
        commitEndsAt,
        revealEndsAt,
        settled: false,
      }),
    ).toBe("SETTLEMENT");

    expect(
      derivePhaseFromWindows({
        nowMs: dayEndsAt - 1,
        commitEndsAt,
        revealEndsAt,
        settled: false,
      }),
    ).toBe("SETTLEMENT");

    expect(
      derivePhaseFromWindows({
        nowMs: revealEndsAt + 10_000,
        commitEndsAt,
        revealEndsAt,
        settled: true,
      }),
    ).toBe("CLAIM");
  });

  it("does not keep Battle after the calendar day rolls (next day index)", () => {
    // At dayEnd, computeDayIndex advances — UI must use the new day's Commit window.
    const day1Start = dayZero + dayLen;
    expect(computeDayIndex(dayZero, dayLen, day1Start * 1000)).toBe(1);

    const commitEndsAt = (day1Start + commit) * 1000;
    const revealEndsAt = (day1Start + commit + reveal) * 1000;
    expect(
      derivePhaseFromWindows({
        nowMs: day1Start * 1000,
        commitEndsAt,
        revealEndsAt,
        settled: false,
      }),
    ).toBe("COMMIT");
  });
});
