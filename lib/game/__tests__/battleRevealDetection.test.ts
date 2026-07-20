import { describe, expect, it } from "vitest";
import {
  isBattleRevealDetected,
  resolveBattleRevealStatus,
} from "@/lib/game/battleRevealDetection";
import { resolveBattleLocationId } from "@/lib/game/resolveBattleLocation";
import { deriveSettlementActivation } from "@/lib/game/settlementActivation";
import { parseSettlementResultSfxId } from "@/lib/game/settlementResults";
import {
  areBattlePresentationRowsReady,
  canMarkBattlePresentationComplete,
  isBattlePresentationDataReady,
} from "@/lib/game/battlePresentationGate";
import { resolveBattleDayRewardWei } from "@/lib/game/battleDayReward";

describe("gasless reveal without localStorage secret", () => {
  it("detects on-chain reveal from locationOf and enables FX", () => {
    const revealed = isBattleRevealDetected({
      committed: true,
      cohortRevealed: false,
      secretRevealed: false,
      locationOf: 4,
      side: "Alpaca",
      pendingRewardWei: null,
      battleReady: true,
    });
    expect(revealed).toBe(true);

    const locationId = resolveBattleLocationId({
      committed: true,
      revealed,
      settled: true,
      locationOf: 4,
      secretLocationId: null,
      cohortLocationId: null,
      side: "Alpaca",
    });
    expect(locationId).toBe(4);

    const activation = deriveSettlementActivation({
      side: "Alpaca",
      gameplayClass: "King",
      locationId: 4,
      adL: 1,
      cdL: 0,
      alpacaParticipantCount: 1,
    });
    expect(parseSettlementResultSfxId(activation.outcome)).toBe("alpaca-safe");

    const rewardWei = resolveBattleDayRewardWei({
      missedReveal: false,
      battleReady: true,
      pendingWei: 32_000n * 10n ** 18n,
    });

    expect(
      areBattlePresentationRowsReady([
        {
          missedReveal: false,
          outcome: activation.outcome,
          locationId,
          rewardWei,
          rewardLabel: "32,000 tHANSOME",
        },
      ]),
    ).toBe(true);
    expect(
      isBattlePresentationDataReady({
        status: "fully_settled",
        hasPresentableRows: true,
      }),
    ).toBe(true);
  });

  it("Day 110-style: server reveal, no local salt, locationOf set → not missed", () => {
    expect(
      resolveBattleRevealStatus({
        committed: true,
        revealPhaseClosed: true,
        cohortIndexed: true,
        cohortRevealed: false,
        secretRevealed: false,
        locationOf: 2,
        locationOfLoaded: true,
        side: "Alpaca",
        pendingRewardWei: 12_000n * 10n ** 18n,
        pendingRewardLoaded: true,
        battleReady: true,
      }),
    ).toBe("revealed");
  });

  it("valid Home location (enum 0) with secret Home is not missed", () => {
    expect(
      resolveBattleRevealStatus({
        committed: true,
        revealPhaseClosed: true,
        cohortIndexed: true,
        cohortRevealed: false,
        secretRevealed: false,
        secretLocationId: 0,
        secretStatus: "submitted",
        locationOf: 0,
        locationOfLoaded: true,
        side: "Alpaca",
        pendingRewardWei: 0n,
        pendingRewardLoaded: true,
        battleReady: true,
      }),
    ).toBe("revealed");
  });

  it("revealed NFT with zero reward (non-Home) is not missed", () => {
    expect(
      resolveBattleRevealStatus({
        committed: true,
        revealPhaseClosed: true,
        cohortIndexed: true,
        cohortRevealed: false,
        secretRevealed: false,
        locationOf: 3,
        locationOfLoaded: true,
        side: "Alpaca",
        pendingRewardWei: 0n,
        pendingRewardLoaded: true,
        battleReady: true,
      }),
    ).toBe("revealed");
  });

  it("logs loading → loading (not missed; presentationComplete blocked)", () => {
    expect(
      resolveBattleRevealStatus({
        committed: true,
        revealPhaseClosed: true,
        cohortIndexed: null,
        cohortRevealed: false,
        secretRevealed: false,
        locationOf: 0,
        locationOfLoaded: true,
        side: "Alpaca",
        pendingRewardWei: null,
        pendingRewardLoaded: false,
        battleReady: true,
      }),
    ).toBe("loading");

    expect(
      canMarkBattlePresentationComplete({
        status: "battle_ready",
        queueStatus: "idle",
        rowsReady: false,
        hasPresentableRows: false,
        presentationFxEnabled: false,
      }),
    ).toBe(false);
  });

  it("true missed reveal after evidence loaded", () => {
    expect(
      resolveBattleRevealStatus({
        committed: true,
        revealPhaseClosed: true,
        cohortIndexed: true,
        cohortRevealed: false,
        secretRevealed: false,
        locationOf: 0,
        locationOfLoaded: true,
        side: "Alpaca",
        pendingRewardWei: 0n,
        pendingRewardLoaded: true,
        battleReady: true,
      }),
    ).toBe("missed");
  });

  it("Day 103 regression: rewards 32000/20000/12000 not false missed", () => {
    const cases = [
      { loc: 4, pending: 32_000n * 10n ** 18n },
      { loc: 3, pending: 20_000n * 10n ** 18n },
      { loc: 2, pending: 12_000n * 10n ** 18n },
    ];
    for (const c of cases) {
      expect(
        resolveBattleRevealStatus({
          committed: true,
          revealPhaseClosed: true,
          cohortIndexed: true,
          cohortRevealed: false,
          secretRevealed: false,
          locationOf: c.loc,
          locationOfLoaded: true,
          side: "Alpaca",
          pendingRewardWei: c.pending,
          pendingRewardLoaded: true,
          battleReady: true,
        }),
      ).toBe("revealed");
      expect(
        resolveBattleDayRewardWei({
          missedReveal: false,
          battleReady: true,
          pendingWei: c.pending,
        }),
      ).toBe(c.pending);
    }
  });
});

describe("presentationComplete gating", () => {
  it("does not complete while rows lack location/reward", () => {
    expect(
      canMarkBattlePresentationComplete({
        status: "battle_ready",
        queueStatus: "idle",
        rowsReady: false,
        hasPresentableRows: false,
        presentationFxEnabled: false,
      }),
    ).toBe(false);
  });

  it("completes after presentable rows played", () => {
    expect(
      canMarkBattlePresentationComplete({
        status: "fully_settled",
        queueStatus: "idle",
        rowsReady: true,
        hasPresentableRows: true,
        presentationFxEnabled: true,
      }),
    ).toBe(true);
  });
});
