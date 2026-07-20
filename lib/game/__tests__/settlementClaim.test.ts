import { describe, expect, it } from "vitest";
import {
  canSubmitClaim,
  deriveSettlementUiStatus,
  isSettlementBattleReady,
  isSettlementFullySettled,
  isSettlementRewardProcessing,
  settlementStatusLabel,
} from "../settlementStatus";

describe("deriveSettlementUiStatus", () => {
  it("loading and error win", () => {
    expect(
      deriveSettlementUiStatus({
        dayState: 4,
        isSettled: false,
        loading: true,
      }),
    ).toBe("loading");
    expect(
      deriveSettlementUiStatus({
        dayState: 4,
        isSettled: false,
        error: "rpc down",
      }),
    ).toBe("error");
  });

  it("SeedMissing / missing day seed → waiting_seed (not generic error)", () => {
    expect(
      deriveSettlementUiStatus({
        dayState: 4,
        isSettled: false,
        error: "Waiting for settlement randomness.",
      }),
    ).toBe("waiting_seed");
    expect(
      deriveSettlementUiStatus({
        dayState: 4,
        isSettled: false,
        hasDaySeed: false,
      }),
    ).toBe("waiting_seed");
  });

  it("maps reveal-closed to available and settled to fully_settled", () => {
    expect(
      deriveSettlementUiStatus({ dayState: 4, isSettled: false }),
    ).toBe("available");
    expect(
      deriveSettlementUiStatus({ dayState: 5, isSettled: false }),
    ).toBe("available");
    expect(
      deriveSettlementUiStatus({ dayState: 4, isSettled: true }),
    ).toBe("fully_settled");
    expect(
      deriveSettlementUiStatus({ dayState: 6, isSettled: true }),
    ).toBe("fully_settled");
  });

  it("settleDay/finalize complete but credits pending → battle_ready", () => {
    expect(
      deriveSettlementUiStatus({
        dayState: 6,
        isSettled: false,
        isFinalized: true,
      }),
    ).toBe("battle_ready");
    expect(
      isSettlementBattleReady("battle_ready"),
    ).toBe(true);
    expect(isSettlementFullySettled("battle_ready")).toBe(false);
    expect(isSettlementRewardProcessing("battle_ready")).toBe(true);
  });

  it("credits complete → fully_settled", () => {
    expect(
      deriveSettlementUiStatus({
        dayState: 6,
        isSettled: true,
        isFinalized: true,
      }),
    ).toBe("fully_settled");
    expect(isSettlementFullySettled("fully_settled")).toBe(true);
    expect(isSettlementRewardProcessing("fully_settled")).toBe(false);
  });

  it("maps commit/reveal windows to pending", () => {
    expect(
      deriveSettlementUiStatus({ dayState: 1, isSettled: false }),
    ).toBe("pending");
    expect(
      deriveSettlementUiStatus({ dayState: 3, isSettled: false }),
    ).toBe("pending");
  });

  it("processing when settle tx pending", () => {
    expect(
      deriveSettlementUiStatus({
        dayState: 4,
        isSettled: false,
        settleTxPending: true,
      }),
    ).toBe("processing");
  });

  it("unavailable when reads missing", () => {
    expect(
      deriveSettlementUiStatus({ dayState: null, isSettled: null }),
    ).toBe("unavailable");
  });

  it("claimable dayState without settled flag → battle_ready", () => {
    expect(
      deriveSettlementUiStatus({ dayState: 6, isSettled: false }),
    ).toBe("battle_ready");
  });
});

describe("canSubmitClaim — duplicate prevention", () => {
  it("allows claim when balance > 0 and idle", () => {
    expect(
      canSubmitClaim({
        claimableTotal: 1n,
        isSubmitting: false,
        hasPendingTx: false,
      }),
    ).toBe(true);
  });

  it("blocks while submitting or pending tx", () => {
    expect(
      canSubmitClaim({
        claimableTotal: 1n,
        isSubmitting: true,
        hasPendingTx: false,
      }),
    ).toBe(false);
    expect(
      canSubmitClaim({
        claimableTotal: 1n,
        isSubmitting: false,
        hasPendingTx: true,
      }),
    ).toBe(false);
  });

  it("blocks zero claimable", () => {
    expect(
      canSubmitClaim({
        claimableTotal: 0n,
        isSubmitting: false,
        hasPendingTx: false,
      }),
    ).toBe(false);
  });
});

describe("settlementStatusLabel", () => {
  it("labels stages", () => {
    expect(settlementStatusLabel("available")).toMatch(/settling/i);
    expect(settlementStatusLabel("pending")).toMatch(/Resolving/i);
    expect(settlementStatusLabel("battle_ready")).toMatch(/Battle ready/i);
    expect(settlementStatusLabel("fully_settled")).toMatch(/Fully settled/i);
    expect(settlementStatusLabel("completed")).toMatch(/Fully settled/i);
  });
});
