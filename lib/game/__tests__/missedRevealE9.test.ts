import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { buildMockSettlementRows } from "@/lib/game/localSettlement";
import type { CommitSecretRecord } from "@/lib/game/commitSecret";
import { interpretLiveSettlementRow } from "@/lib/game/interpretSettlementRow";
import {
  e9ZeroReward,
  isCommitWithoutReveal,
  isRevealPhaseClosed,
  MISSED_REVEAL_OUTCOME,
} from "@/lib/game/missedReveal";
import { deriveSettlementUiStatus } from "@/lib/game/settlementStatus";
import { formatRobinhoodWriteError } from "@/lib/game/robinhoodContractWrite";
import { gameEn } from "@/content/i18n/game/en";
import { gameZh } from "@/content/i18n/game/zh";

function secret(
  partial: Partial<CommitSecretRecord> &
    Pick<CommitSecretRecord, "tokenId" | "status">,
): CommitSecretRecord {
  return {
    day: 7,
    locationId: 2,
    salt: "0x01" as Hex,
    commitHash: "0x02" as Hex,
    updatedAt: 1,
    ...partial,
  };
}

describe("E9 commit without reveal — mock UI", () => {
  it("gives commit-only tokens reward 0 and missed_reveal outcome", () => {
    const rows = buildMockSettlementRows(7, [
      secret({ tokenId: 14, status: "revealed", locationId: 2 }),
      secret({ tokenId: 22, status: "submitted", locationId: 3 }),
      secret({ tokenId: 1, status: "prepared", locationId: 1 }),
    ]);

    const revealed = rows.find((r) => r.tokenId === 14)!;
    const commitOnlyA = rows.find((r) => r.tokenId === 22)!;
    const commitOnlyB = rows.find((r) => r.tokenId === 1)!;

    expect(revealed.missedReveal).toBeFalsy();
    expect(revealed.rewardHansome).toBeGreaterThan(0);

    for (const row of [commitOnlyA, commitOnlyB]) {
      expect(row.missedReveal).toBe(true);
      expect(row.rewardHansome).toBe(e9ZeroReward());
      expect(row.rewardHansome).toBe(0);
      expect(row.outcome).toBe(MISSED_REVEAL_OUTCOME);
      expect(row.activatedAbility).toBeNull();
      expect(row.ability).toBeNull();
    }
  });

  it("excludes commit-only tokens from location denominators (only revealed count)", () => {
    // One revealed alpaca + one commit-only at same location — revealed still settles alone.
    const rows = buildMockSettlementRows(7, [
      secret({ tokenId: 14, status: "revealed", locationId: 2 }),
      secret({ tokenId: 99, status: "submitted", locationId: 2 }),
    ]);
    const revealed = rows.find((r) => r.tokenId === 14)!;
    expect(revealed.rewardHansome).toBeGreaterThan(0);
    expect(rows.find((r) => r.tokenId === 99)!.rewardHansome).toBe(0);
  });
});

describe("E9 commit without reveal — live-chain interpretation", () => {
  it("after Reveal closed: committed + not revealed → 0 + missed_reveal", () => {
    const r = interpretLiveSettlementRow({
      phase: "SETTLEMENT",
      dayState: 4,
      settled: false,
      committed: true,
      revealed: false,
    });
    expect(r.missedReveal).toBe(true);
    expect(r.rewardHansome).toBe(0);
    expect(r.outcomeKey).toBe(MISSED_REVEAL_OUTCOME);
    expect(r.suppressActivation).toBe(true);
  });

  it("while Reveal still open: keep awaiting reveal (not missed)", () => {
    expect(
      isRevealPhaseClosed({ phase: "REVEAL", dayState: 3, settled: false }),
    ).toBe(false);

    const r = interpretLiveSettlementRow({
      phase: "REVEAL",
      dayState: 3,
      settled: false,
      committed: true,
      revealed: false,
    });
    expect(r.missedReveal).toBe(false);
    expect(r.outcomeKey).toBe("awaiting_reveal");
    expect(
      isCommitWithoutReveal({
        revealPhaseClosed: false,
        committed: true,
        revealed: false,
      }),
    ).toBe(false);
  });

  it("settled + revealed → not E9", () => {
    const r = interpretLiveSettlementRow({
      phase: "CLAIM",
      dayState: 6,
      settled: true,
      committed: true,
      revealed: true,
    });
    expect(r.missedReveal).toBe(false);
    expect(r.suppressActivation).toBe(false);
  });
});

describe("missing day seed UI status", () => {
  it("maps SeedMissing to waiting_seed, not generic error", () => {
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
    expect(
      formatRobinhoodWriteError(
        new Error("Error: SeedMissing()\nContract Call:"),
        "fallback",
      ),
    ).toBe("Waiting for settlement randomness.");
  });
});

describe("missed reveal i18n", () => {
  it("has EN + ZH copy for the three required lines", () => {
    expect(gameEn.settlement.missedRevealTitle).toBe(
      "You missed today’s Reveal.",
    );
    expect(gameEn.settlement.missedRevealZero).toMatch(/0 rewards/);
    expect(gameEn.settlement.missedRevealNext).toMatch(/next round/);

    expect(gameZh.settlement.missedRevealTitle).toBe("你錯過了今日的揭露。");
    expect(gameZh.settlement.missedRevealZero).toMatch(/0/);
    expect(gameZh.settlement.missedRevealNext).toMatch(/下一輪/);
    expect(gameZh.settlement.waitingSeedTitle).toBe("等待結算隨機數。");
  });
});
