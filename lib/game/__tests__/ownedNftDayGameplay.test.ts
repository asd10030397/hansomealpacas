import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveOwnedNftDayGameplayState,
  ZERO_COMMIT_HASH,
} from "@/lib/game/ownedNftDayGameplay";

const HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111" as const;

describe("deriveOwnedNftDayGameplayState", () => {
  it("is Idle when gameplay day is unknown", () => {
    expect(
      deriveOwnedNftDayGameplayState({
        gameplayDay: null,
        commitHash: HASH,
        locationOf: 2,
      }),
    ).toEqual({ gameStatus: "Idle", selectedLocationId: null });
  });

  it("is Idle with no location when there is no commit for the day", () => {
    expect(
      deriveOwnedNftDayGameplayState({
        gameplayDay: 5,
        commitHash: ZERO_COMMIT_HASH,
        locationOf: 0,
        secretLocationId: 3,
        secretStatus: "submitted",
      }),
    ).toEqual({ gameStatus: "Idle", selectedLocationId: null });

    expect(
      deriveOwnedNftDayGameplayState({
        gameplayDay: 5,
        commitHash: undefined,
        locationOf: 2,
      }),
    ).toEqual({ gameStatus: "Idle", selectedLocationId: null });
  });

  it("shows Committed + secret location before reveal", () => {
    expect(
      deriveOwnedNftDayGameplayState({
        gameplayDay: 5,
        commitHash: HASH,
        locationOf: 0,
        secretLocationId: 2,
        secretStatus: "submitted",
      }),
    ).toEqual({ gameStatus: "Committed", selectedLocationId: 2 });
  });

  it("shows Revealed when on-chain location is non-zero", () => {
    expect(
      deriveOwnedNftDayGameplayState({
        gameplayDay: 5,
        commitHash: HASH,
        locationOf: 3,
      }),
    ).toEqual({ gameStatus: "Revealed", selectedLocationId: 3 });
  });

  it("marks Settled only when the current day is settled and committed", () => {
    expect(
      deriveOwnedNftDayGameplayState({
        gameplayDay: 5,
        commitHash: HASH,
        locationOf: 1,
        daySettled: true,
      }),
    ).toEqual({ gameStatus: "Settled", selectedLocationId: 1 });

    expect(
      deriveOwnedNftDayGameplayState({
        gameplayDay: 5,
        commitHash: ZERO_COMMIT_HASH,
        locationOf: 0,
        daySettled: true,
      }),
    ).toEqual({ gameStatus: "Idle", selectedLocationId: null });
  });
});

describe("Day N → Day N+1 gameplay reset regression", () => {
  beforeEach(() => {
    vi.resetModules();
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(`session:${k}`) ?? null,
      setItem: (k: string, v: string) => {
        store.set(`session:${k}`, v);
      },
      removeItem: (k: string) => {
        store.delete(`session:${k}`);
      },
    });
  });

  it("resets status/location and drops prior-day secrets after day rollover", async () => {
    const {
      upsertCommitSecret,
      getCommitSecret,
      syncGameplayDayClientState,
      setPendingLocation,
      getPendingLocation,
      generateSalt,
    } = await import("@/lib/game/commitSecret");

    const wallet = "0xce152894df356741e7cfdfdd9d0b4d1fdf4a069a";
    const dayN = 10;
    const dayN1 = 11;

    // 1) Commit NFTs on Day N (local + on-chain-shaped hash for Day N).
    upsertCommitSecret({
      tokenId: 1,
      day: dayN,
      locationId: 2,
      salt: generateSalt(),
      status: "submitted",
      wallet,
    });
    upsertCommitSecret({
      tokenId: 16,
      day: dayN,
      locationId: 4,
      salt: generateSalt(),
      status: "submitted",
      wallet,
    });
    setPendingLocation(3, dayN);

    const dayNState = deriveOwnedNftDayGameplayState({
      gameplayDay: dayN,
      commitHash: HASH,
      locationOf: 0,
      secretLocationId: getCommitSecret(1, dayN, wallet)?.locationId,
      secretStatus: getCommitSecret(1, dayN, wallet)?.status,
    });
    expect(dayNState).toEqual({
      gameStatus: "Committed",
      selectedLocationId: 2,
    });

    // 2) Advance to Day N+1 — prune prior-day client state.
    syncGameplayDayClientState(dayN1);

    // 3) Every NFT is fresh: not committed, no location, ready to choose.
    for (const tokenId of [1, 16]) {
      expect(getCommitSecret(tokenId, dayN, wallet)).toBeNull();
      expect(getCommitSecret(tokenId, dayN1, wallet)).toBeNull();

      // On-chain: Day N+1 commitHashOf is zero even if Day N still has a hash.
      const nextDay = deriveOwnedNftDayGameplayState({
        gameplayDay: dayN1,
        commitHash: ZERO_COMMIT_HASH,
        locationOf: 0,
        secretLocationId: getCommitSecret(tokenId, dayN1, wallet)?.locationId,
        secretStatus: getCommitSecret(tokenId, dayN1, wallet)?.status,
        // Leftover claimable must not paint Committed/Settled for today.
        daySettled: false,
      });
      expect(nextDay).toEqual({
        gameStatus: "Idle",
        selectedLocationId: null,
      });
    }

    // 4) Stale session handoff / prior-day secrets cannot reappear.
    expect(getPendingLocation(dayN1)).toBeNull();
    expect(getPendingLocation(dayN)).toBeNull();

    // Reading Day N hash while UI day is N+1 must not show Committed
    // (guard: callers must pass the clock day + that day's hash).
    expect(
      deriveOwnedNftDayGameplayState({
        gameplayDay: dayN1,
        commitHash: ZERO_COMMIT_HASH,
        // Stale Day N location must be ignored when hash for N+1 is empty.
        locationOf: 2,
        secretLocationId: 2,
        secretStatus: "submitted",
      }),
    ).toEqual({ gameStatus: "Idle", selectedLocationId: null });
  });
});
