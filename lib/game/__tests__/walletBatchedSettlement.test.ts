import { describe, expect, it } from "vitest";
import {
  isBenignSettlementRevert,
  planWalletSettlementStep,
} from "@/lib/game/walletBatchedSettlement";

describe("planWalletSettlementStep", () => {
  it("finalizeDay when not finalized → battle_ready path", () => {
    expect(
      planWalletSettlementStep({
        progress: {
          cursor: 0,
          total: 3,
          finalized: false,
          settled: false,
        },
        settleEligible: true,
      }),
    ).toEqual({ action: "finalize" });
  });

  it("partial credit resumes from cursor (not zero)", () => {
    const plan = planWalletSettlementStep({
      progress: {
        cursor: 1,
        total: 3,
        finalized: true,
        settled: false,
      },
      settleEligible: true,
      batchLimit: 25,
    });
    expect(plan).toEqual({
      action: "credit",
      limit: 25,
      cursor: 1,
      total: 3,
    });
  });

  it("fully credited → no more transactions", () => {
    expect(
      planWalletSettlementStep({
        progress: {
          cursor: 3,
          total: 3,
          finalized: true,
          settled: true,
        },
        settleEligible: true,
      }),
    ).toEqual({ action: "done", cursor: 3, total: 3 });
  });

  it("benign concurrent AlreadyFinalized is recognized", () => {
    expect(isBenignSettlementRevert("AlreadyFinalized()")).toBe(true);
    expect(isBenignSettlementRevert("creditBatch failed")).toBe(false);
  });
});
