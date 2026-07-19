import { describe, expect, it } from "vitest";
import {
  canSubmitClaim,
  deriveSettlementUiStatus,
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

  it("maps reveal-closed to available and settled to completed", () => {
    expect(
      deriveSettlementUiStatus({ dayState: 4, isSettled: false }),
    ).toBe("available");
    expect(
      deriveSettlementUiStatus({ dayState: 5, isSettled: false }),
    ).toBe("available");
    expect(
      deriveSettlementUiStatus({ dayState: 4, isSettled: true }),
    ).toBe("completed");
    expect(
      deriveSettlementUiStatus({ dayState: 6, isSettled: true }),
    ).toBe("completed");
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

  it("blocks when nothing claimable", () => {
    expect(
      canSubmitClaim({
        claimableTotal: 0n,
        isSubmitting: false,
        hasPendingTx: false,
      }),
    ).toBe(false);
  });

  it("blocks while submitting or tx pending", () => {
    expect(
      canSubmitClaim({
        claimableTotal: 100n,
        isSubmitting: true,
        hasPendingTx: false,
      }),
    ).toBe(false);
    expect(
      canSubmitClaim({
        claimableTotal: 100n,
        isSubmitting: false,
        hasPendingTx: true,
      }),
    ).toBe(false);
  });
});

describe("settlementStatusLabel", () => {
  it("returns stable labels", () => {
    expect(settlementStatusLabel("available")).toMatch(/settling|Reveal closed/i);
    expect(settlementStatusLabel("pending")).toMatch(/arena|revealed/i);
    expect(settlementStatusLabel("completed")).toMatch(/Completed/i);
  });
});
