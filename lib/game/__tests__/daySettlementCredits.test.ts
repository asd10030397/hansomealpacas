import { describe, expect, it } from "vitest";
import {
  mergeCreditedAmounts,
  parseCreditedLogsFromReceipt,
} from "@/lib/game/daySettlementCredits";
import { encodeEventTopics, toHex } from "viem";

describe("daySettlementCredits", () => {
  it("merges credited amounts per token", () => {
    const map = mergeCreditedAmounts([
      { tokenId: 27, amount: 20_400n * 10n ** 18n },
      { tokenId: 28, amount: 20_400n * 10n ** 18n },
      { tokenId: 27, amount: 100n },
    ]);
    expect(map.get(27)).toBe(20_400n * 10n ** 18n + 100n);
    expect(map.get(28)).toBe(20_400n * 10n ** 18n);
    expect(map.get(30)).toBeUndefined();
  });

  it("parses Credited logs and ignores unrelated topics", () => {
    const topics = encodeEventTopics({
      abi: [
        {
          type: "event",
          name: "Credited",
          inputs: [
            { name: "tokenId", type: "uint256", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
          ],
        },
      ],
      eventName: "Credited",
      args: { tokenId: 29n },
    });
    const amount = 16_000n * 10n ** 18n;
    const data = toHex(amount, { size: 32 });
    const map = parseCreditedLogsFromReceipt([
      {
        address: "0x7Fb2437542041AbaC22E0A88dF2e0A9c3346e1d2",
        topics: topics as [`0x${string}`, ...`0x${string}`[]],
        data,
        blockHash: "0x1",
        blockNumber: 1n,
        logIndex: 0,
        transactionHash: "0x2",
        transactionIndex: 0,
        removed: false,
      },
    ]);
    expect(map.get(29)).toBe(amount);
  });
});
