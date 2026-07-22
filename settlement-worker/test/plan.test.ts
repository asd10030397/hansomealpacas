import { describe, expect, it } from "vitest";
import { isBenignRevert, planSettlementStep } from "../src/loop/plan.js";

describe("planSettlementStep", () => {
  it("requests seed when missing and phase ok", () => {
    expect(
      planSettlementStep({
        hasDaySeed: false,
        seedPhaseOk: true,
        settlePhaseOk: false,
        progress: null,
      }),
    ).toEqual({ action: "seed" });
  });

  it("waits when seed phase not ok", () => {
    expect(
      planSettlementStep({
        hasDaySeed: false,
        seedPhaseOk: false,
        settlePhaseOk: false,
        progress: null,
      }),
    ).toEqual({ action: "noop", reason: "waiting_seed" });
  });

  it("finalizes when seed ready and settle phase ok", () => {
    expect(
      planSettlementStep({
        hasDaySeed: true,
        seedPhaseOk: true,
        settlePhaseOk: true,
        progress: { cursor: 0, total: 0, finalized: false, settled: false },
      }),
    ).toEqual({ action: "finalize" });
  });

  it("credits in batches after finalize", () => {
    expect(
      planSettlementStep({
        hasDaySeed: true,
        seedPhaseOk: true,
        settlePhaseOk: true,
        progress: { cursor: 10, total: 40, finalized: true, settled: false },
        batchLimit: 50,
      }),
    ).toEqual({ action: "credit", limit: 50, cursor: 10, total: 40 });
  });

  it("done when settled", () => {
    expect(
      planSettlementStep({
        hasDaySeed: true,
        seedPhaseOk: true,
        settlePhaseOk: true,
        progress: { cursor: 40, total: 40, finalized: true, settled: true },
      }),
    ).toEqual({ action: "done", cursor: 40, total: 40 });
  });

  it("detects benign reverts", () => {
    expect(isBenignRevert("execution reverted: AlreadyFinalized()")).toBe(true);
    expect(isBenignRevert("SeedAlreadySet")).toBe(true);
    expect(isBenignRevert("insufficient funds")).toBe(false);
  });
});
