import { beforeEach, describe, expect, it } from "vitest";
import {
  getAutoNavigatedToCommit,
  isBattleToCommitTransition,
  planAutoNavigateToCommit,
  resetAutoNavigateToCommitForTests,
  setAutoNavigatedToCommit,
  shouldScrollAfterAutoNavigateToCommit,
} from "@/lib/game/autoNavigateToCommit";

const COMMIT = "/game/commit";
const EXPLORE = "/game/explore";
const RESULT = "/game/result";

beforeEach(() => {
  resetAutoNavigateToCommitForTests();
});

describe("isBattleToCommitTransition", () => {
  it("true when day advances from battle phase into COMMIT", () => {
    expect(
      isBattleToCommitTransition({
        previousDay: 21,
        currentDay: 22,
        previousPhase: "CLAIM",
        currentPhase: "COMMIT",
      }),
    ).toBe(true);
    expect(
      isBattleToCommitTransition({
        previousDay: 21,
        currentDay: 22,
        previousPhase: "REVEAL",
        currentPhase: "COMMIT",
      }),
    ).toBe(true);
  });

  it("false on initial COMMIT hydration (no previous)", () => {
    expect(
      isBattleToCommitTransition({
        previousDay: null,
        currentDay: 22,
        previousPhase: null,
        currentPhase: "COMMIT",
      }),
    ).toBe(false);
  });

  it("false when same day or not COMMIT", () => {
    expect(
      isBattleToCommitTransition({
        previousDay: 22,
        currentDay: 22,
        previousPhase: "CLAIM",
        currentPhase: "COMMIT",
      }),
    ).toBe(false);
    expect(
      isBattleToCommitTransition({
        previousDay: 21,
        currentDay: 22,
        previousPhase: "COMMIT",
        currentPhase: "COMMIT",
      }),
    ).toBe(false);
    expect(
      isBattleToCommitTransition({
        previousDay: 21,
        currentDay: 22,
        previousPhase: "CLAIM",
        currentPhase: "REVEAL",
      }),
    ).toBe(false);
  });
});

describe("planAutoNavigateToCommit", () => {
  const base = {
    previousDay: 21,
    currentDay: 22,
    previousPhase: "CLAIM" as const,
    currentPhase: "COMMIT" as const,
    pathname: RESULT,
    commitPath: COMMIT,
    explorePath: EXPLORE,
    resultPath: RESULT,
    alreadyHandled: false,
    presentationIdle: true,
  };

  it("navigates from Battle Result when idle", () => {
    expect(planAutoNavigateToCommit(base)).toEqual({ action: "navigate" });
  });

  it("waits while presentation is busy", () => {
    expect(
      planAutoNavigateToCommit({ ...base, presentationIdle: false }),
    ).toEqual({ action: "noop" });
  });

  it("mark_only when already on Choose Location", () => {
    expect(
      planAutoNavigateToCommit({ ...base, pathname: COMMIT }),
    ).toEqual({ action: "mark_only" });
  });

  it("navigates from other game pages", () => {
    expect(
      planAutoNavigateToCommit({ ...base, pathname: "/game" }),
    ).toEqual({ action: "navigate" });
  });

  it("noop when already handled (no repeat)", () => {
    expect(
      planAutoNavigateToCommit({ ...base, alreadyHandled: true }),
    ).toEqual({ action: "noop" });
  });

  it("noop without battle→commit transition", () => {
    expect(
      planAutoNavigateToCommit({
        ...base,
        previousDay: null,
        previousPhase: null,
      }),
    ).toEqual({ action: "noop" });
  });
});

describe("session flags", () => {
  it("pending enables scroll once; done blocks", () => {
    expect(getAutoNavigatedToCommit("0xAb", 22)).toBeNull();
    setAutoNavigatedToCommit("0xAb", 22, "pending");
    expect(shouldScrollAfterAutoNavigateToCommit("0xAb", 22)).toBe(true);
    setAutoNavigatedToCommit("0xAb", 22, "done");
    expect(shouldScrollAfterAutoNavigateToCommit("0xAb", 22)).toBe(false);
    expect(getAutoNavigatedToCommit("0xab", 22)).toBe("done");
  });
});
