import { describe, expect, it } from "vitest";
import { isBattleRevealDetected } from "@/lib/game/battleRevealDetection";
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
    // Relayer revealed on-chain; client has no commit secret / no Revealed logs yet.
    const revealed = isBattleRevealDetected({
      committed: true,
      cohortRevealed: false,
      secretRevealed: false,
      locationOf: 4, // River
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

    const row = {
      missedReveal: false,
      outcome: activation.outcome,
      locationId,
      rewardWei,
      rewardLabel: "32,000 tHANSOME",
      activatedAbility: activation.activatedAbility,
    };

    expect(areBattlePresentationRowsReady([row])).toBe(true);
    expect(
      isBattlePresentationDataReady({
        status: "fully_settled",
        hasPresentableRows: true,
      }),
    ).toBe(true);
  });

  it("does not mark missedReveal when commit + locationOf prove reveal", () => {
    expect(
      isBattleRevealDetected({
        committed: true,
        locationOf: 3,
        side: "Alpaca",
      }),
    ).toBe(true);
    expect(
      isBattleRevealDetected({
        committed: true,
        locationOf: 0,
        side: "Alpaca",
        battleReady: false,
      }),
    ).toBe(false);
  });
});

describe("presentationComplete gating", () => {
  it("does not complete while rows lack location/reward (missing frontend data)", () => {
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

  it("completes after presentable rows played (queue idle + FX enabled)", () => {
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
