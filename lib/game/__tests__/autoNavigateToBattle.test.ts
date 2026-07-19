import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAutoNavigatedToBattle,
  isCommitToBattleTransition,
  planAutoNavigateToBattle,
  resetAutoNavigateToBattleForTests,
  setAutoNavigatedToBattle,
  shouldScrollAfterAutoNavigate,
} from "@/lib/game/autoNavigateToBattle";

const CHOOSE = ["/game/commit", "/game/explore"] as const;
const RESULT = "/game/result";

describe("autoNavigateToBattle", () => {
  afterEach(() => {
    resetAutoNavigateToBattleForTests();
    vi.unstubAllGlobals();
  });

  it("detects CommitOpen → RevealOpen / Battle Result only", () => {
    expect(isCommitToBattleTransition("COMMIT", "REVEAL")).toBe(true);
    expect(isCommitToBattleTransition("COMMIT", "SETTLEMENT")).toBe(true);
    expect(isCommitToBattleTransition("COMMIT", "CLAIM")).toBe(true);
    expect(isCommitToBattleTransition("COMMIT", "COMMIT")).toBe(false);
    expect(isCommitToBattleTransition("REVEAL", "CLAIM")).toBe(false);
    expect(isCommitToBattleTransition(null, "REVEAL")).toBe(false);
  });

  it("Commit page open → timer expires → navigates to Battle Result once", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
    });
    vi.stubGlobal("window", { sessionStorage: sessionStorage });

    const wallet = "0xAbc";
    const day = 42;

    const first = planAutoNavigateToBattle({
      previousPhase: "COMMIT",
      currentPhase: "REVEAL",
      pathname: "/game/commit",
      resultPath: RESULT,
      choosePaths: CHOOSE,
      alreadyHandled: getAutoNavigatedToBattle(wallet, day) != null,
    });
    expect(first).toEqual({ action: "navigate" });

    setAutoNavigatedToBattle(wallet, day, "pending");
    expect(shouldScrollAfterAutoNavigate(wallet, day)).toBe(true);

    const second = planAutoNavigateToBattle({
      previousPhase: "COMMIT",
      currentPhase: "REVEAL",
      pathname: "/game/commit",
      resultPath: RESULT,
      choosePaths: CHOOSE,
      alreadyHandled: getAutoNavigatedToBattle(wallet, day) != null,
    });
    expect(second).toEqual({ action: "noop" });
  });

  it("does not interrupt users already on Battle Result", () => {
    const plan = planAutoNavigateToBattle({
      previousPhase: "COMMIT",
      currentPhase: "REVEAL",
      pathname: "/game/result",
      resultPath: RESULT,
      choosePaths: CHOOSE,
      alreadyHandled: false,
    });
    expect(plan).toEqual({ action: "mark_only" });
  });

  it("also auto-routes from explore (Choose Location)", () => {
    expect(
      planAutoNavigateToBattle({
        previousPhase: "COMMIT",
        currentPhase: "CLAIM",
        pathname: "/game/explore",
        resultPath: RESULT,
        choosePaths: CHOOSE,
        alreadyHandled: false,
      }),
    ).toEqual({ action: "navigate" });
  });

  it("rotates naturally on the next day", () => {
    setAutoNavigatedToBattle("0x1", 10, "done");
    expect(
      planAutoNavigateToBattle({
        previousPhase: "COMMIT",
        currentPhase: "REVEAL",
        pathname: "/game/commit",
        resultPath: RESULT,
        choosePaths: CHOOSE,
        alreadyHandled: getAutoNavigatedToBattle("0x1", 10) != null,
      }),
    ).toEqual({ action: "noop" });

    expect(
      planAutoNavigateToBattle({
        previousPhase: "COMMIT",
        currentPhase: "REVEAL",
        pathname: "/game/commit",
        resultPath: RESULT,
        choosePaths: CHOOSE,
        alreadyHandled: getAutoNavigatedToBattle("0x1", 11) != null,
      }),
    ).toEqual({ action: "navigate" });
  });
});
