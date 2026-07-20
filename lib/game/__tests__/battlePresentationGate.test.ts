import { beforeEach, describe, expect, it } from "vitest";
import {
  areBattlePresentationRowsReady,
  canMarkBattlePresentationComplete,
  canNavigateAfterBattle,
  isBattlePresentationBusy,
  isBattlePresentationComplete,
  isBattlePresentationDataReady,
  isBattlePresentationRowReady,
  isBattleSettlementPreparing,
  isPresentationQueueIdle,
  markBattlePresentationComplete,
  releasePresentationOwner,
  resetBattlePresentationGateForTests,
  setBattlePresentationBusy,
  setPresentationPreparing,
  setPresentationQueueActive,
} from "@/lib/game/battlePresentationGate";

beforeEach(() => {
  resetBattlePresentationGateForTests();
});

describe("presentationComplete is single source of truth", () => {
  it("COMMIT-ready only when complete + queue idle", () => {
    expect(canNavigateAfterBattle("0x1", 21)).toBe(false);
    markBattlePresentationComplete("0x1", 21);
    expect(isBattlePresentationComplete("0x1", 21)).toBe(true);
    expect(canNavigateAfterBattle("0x1", 21)).toBe(true);
  });

  it("busy false alone never allows navigation", () => {
    expect(isBattlePresentationBusy()).toBe(false);
    expect(isPresentationQueueIdle()).toBe(true);
    expect(canNavigateAfterBattle("0x1", 21)).toBe(false);
  });

  it("complete + queue busy → cannot navigate", () => {
    markBattlePresentationComplete("0x1", 21);
    setPresentationQueueActive("result-page", true);
    expect(canNavigateAfterBattle("0x1", 21)).toBe(false);
    setPresentationQueueActive("result-page", false);
    expect(canNavigateAfterBattle("0x1", 21)).toBe(true);
  });

  it("mark complete is idempotent (exactly once semantics)", () => {
    markBattlePresentationComplete("0x1", 21);
    markBattlePresentationComplete("0x1", 21);
    expect(isBattlePresentationComplete("0x1", 21)).toBe(true);
    expect(canNavigateAfterBattle("0x1", 21)).toBe(true);
  });
});

describe("ownership / React cleanup", () => {
  it("releasePresentationOwner clears busy but not presentationComplete", () => {
    setPresentationPreparing("result-page", true);
    setPresentationQueueActive("result-page", true);
    markBattlePresentationComplete("0x1", 21);
    expect(isBattlePresentationBusy()).toBe(true);

    releasePresentationOwner("result-page");
    expect(isBattlePresentationBusy()).toBe(false);
    expect(isBattlePresentationComplete("0x1", 21)).toBe(true);
    expect(canNavigateAfterBattle("0x1", 21)).toBe(true);
  });

  it("legacy setBattlePresentationBusy(false) cannot wipe complete", () => {
    markBattlePresentationComplete("0x1", 21);
    setBattlePresentationBusy(true);
    setBattlePresentationBusy(false);
    expect(isBattlePresentationComplete("0x1", 21)).toBe(true);
  });
});

describe("preparing + battle-ready helpers", () => {
  it("unavailable/loading/error remain preparing", () => {
    for (const status of [
      "loading",
      "pending",
      "unavailable",
      "error",
      "processing",
      "waiting_seed",
      "available",
    ] as const) {
      expect(
        isBattleSettlementPreparing({ status, revealing: false }),
      ).toBe(true);
    }
    expect(
      isBattleSettlementPreparing({ status: "battle_ready", revealing: false }),
    ).toBe(false);
    expect(
      isBattleSettlementPreparing({ status: "fully_settled", revealing: false }),
    ).toBe(false);
    expect(
      isBattleSettlementPreparing({ status: "battle_ready", revealing: true }),
    ).toBe(true);
  });

  it("battle_ready can begin presentation before credits finish", () => {
    expect(
      isBattlePresentationDataReady({
        status: "battle_ready",
        hasPresentableRows: true,
      }),
    ).toBe(true);
    expect(
      isBattlePresentationDataReady({
        status: "processing",
        hasPresentableRows: true,
      }),
    ).toBe(false);
    expect(
      isBattlePresentationDataReady({
        status: "battle_ready",
        hasPresentableRows: false,
      }),
    ).toBe(false);
  });

  it("rowsReady requires outcome + location + reward (not awaiting)", () => {
    expect(
      isBattlePresentationRowReady({
        outcome: "awaiting_settlement",
        locationId: 4,
        rewardWei: 1n,
      }),
    ).toBe(false);
    expect(
      isBattlePresentationRowReady({
        outcome: "Safe (no hunt)",
        locationId: 4,
        rewardWei: 32_000n * 10n ** 18n,
        rewardLabel: "32,000 tHANSOME",
      }),
    ).toBe(true);
    expect(
      areBattlePresentationRowsReady([
        {
          missedReveal: true,
          outcome: "missed_reveal",
          locationId: null,
          rewardWei: 0n,
        },
      ]),
    ).toBe(true);
  });

  it("does not mark complete when presentable rows exist but FX not enabled", () => {
    expect(
      canMarkBattlePresentationComplete({
        status: "battle_ready",
        queueStatus: "idle",
        rowsReady: true,
        hasPresentableRows: true,
        presentationFxEnabled: false,
      }),
    ).toBe(false);
  });
});
