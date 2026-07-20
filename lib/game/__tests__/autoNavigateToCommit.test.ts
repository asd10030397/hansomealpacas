import { beforeEach, describe, expect, it } from "vitest";
import {
  battleDayForCommitNav,
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
  });
});

describe("battleDayForCommitNav", () => {
  it("maps next COMMIT day to previous battle day", () => {
    expect(battleDayForCommitNav(22)).toBe(21);
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
    presentationComplete: true,
    queueIdle: true,
  };

  it("COMMIT + presentation incomplete → no navigation", () => {
    expect(
      planAutoNavigateToCommit({ ...base, presentationComplete: false }),
    ).toEqual({ action: "noop" });
  });

  it("COMMIT + busy false alone (incomplete) → no navigation", () => {
    // queueIdle true mimics busy-false; still blocked without presentationComplete
    expect(
      planAutoNavigateToCommit({
        ...base,
        presentationComplete: false,
        queueIdle: true,
      }),
    ).toEqual({ action: "noop" });
  });

  it("COMMIT + presentation complete + queue busy → no navigation", () => {
    expect(
      planAutoNavigateToCommit({ ...base, queueIdle: false }),
    ).toEqual({ action: "noop" });
  });

  it("COMMIT + presentation complete + queue idle → navigate exactly once plan", () => {
    expect(planAutoNavigateToCommit(base)).toEqual({ action: "navigate" });
  });

  it("mark_only when already on Choose Location", () => {
    expect(
      planAutoNavigateToCommit({ ...base, pathname: COMMIT }),
    ).toEqual({ action: "mark_only" });
  });

  it("navigates from other game pages when complete", () => {
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

describe("session flags — duplicate polling cannot double-navigate", () => {
  it("pending enables scroll once; done blocks", () => {
    expect(getAutoNavigatedToCommit("0xAb", 22)).toBeNull();
    setAutoNavigatedToCommit("0xAb", 22, "pending");
    expect(shouldScrollAfterAutoNavigateToCommit("0xAb", 22)).toBe(true);
    setAutoNavigatedToCommit("0xAb", 22, "done");
    expect(shouldScrollAfterAutoNavigateToCommit("0xAb", 22)).toBe(false);
    expect(getAutoNavigatedToCommit("0xab", 22)).toBe("done");
  });

  it("alreadyHandled plan stays noop across repeated polls", () => {
    setAutoNavigatedToCommit("0xAb", 22, "pending");
    const plan = planAutoNavigateToCommit({
      previousDay: 21,
      currentDay: 22,
      previousPhase: "CLAIM",
      currentPhase: "COMMIT",
      pathname: RESULT,
      commitPath: COMMIT,
      explorePath: EXPLORE,
      resultPath: RESULT,
      alreadyHandled: getAutoNavigatedToCommit("0xAb", 22) != null,
      presentationComplete: true,
      queueIdle: true,
    });
    expect(plan).toEqual({ action: "noop" });
  });
});
