import { describe, expect, it } from "vitest";
import { resolveBattleDayRewardWei } from "@/lib/game/battleDayReward";

describe("resolveBattleDayRewardWei — batched creditBatch", () => {
  it("after isSettled, displays pendingRewardOf (not DaySettled Credited map)", () => {
    // DaySettled tx has no Credited logs; creditBatch wrote rewards later.
    // UI must still show HansomeGame.pendingRewardOf values.
    const day103 = [
      { tokenId: 1, pending: 32_000n * 10n ** 18n },
      { tokenId: 2, pending: 20_000n * 10n ** 18n },
      { tokenId: 3, pending: 12_000n * 10n ** 18n },
    ];

    for (const row of day103) {
      expect(
        resolveBattleDayRewardWei({
          missedReveal: false,
          battleReady: true,
          pendingWei: row.pending,
        }),
      ).toBe(row.pending);
    }
  });

  it("returns null while pendingRewardOf is still loading", () => {
    expect(
      resolveBattleDayRewardWei({
        missedReveal: false,
        battleReady: true,
        pendingWei: null,
      }),
    ).toBeNull();
  });

  it("forces 0 on missed reveal", () => {
    expect(
      resolveBattleDayRewardWei({
        missedReveal: true,
        battleReady: true,
        pendingWei: 32_000n * 10n ** 18n,
      }),
    ).toBe(0n);
  });

  it("hides amount before battle-ready (finalize)", () => {
    expect(
      resolveBattleDayRewardWei({
        missedReveal: false,
        battleReady: false,
        pendingWei: 32_000n * 10n ** 18n,
      }),
    ).toBeNull();
  });
});
