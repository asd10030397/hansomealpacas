/**
 * Legacy helper: Credited logs attached to a DaySettled transaction.
 *
 * Batched settlement (finalizeDay + creditBatch) emits DaySettled without
 * Credited logs — Battle Result must use HansomeGame.pendingRewardOf instead
 * (see battleDayReward.ts). Keep this for older single-tx settleDay receipts.
 *
 * RewardDistributor.claimable(tokenId) is cumulative — never use as "today's reward".
 */

import {
  decodeEventLog,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
} from "viem";

export const DAY_SETTLED_EVENT = {
  type: "event",
  name: "DaySettled",
  inputs: [
    { name: "day", type: "uint256", indexed: true },
    { name: "rd", type: "uint256", indexed: false },
    { name: "pen", type: "uint256", indexed: false },
    { name: "huntDust", type: "uint256", indexed: false },
    { name: "unallocated", type: "uint256", indexed: false },
    { name: "playerTotal", type: "uint256", indexed: false },
  ],
} as const;

export const DISTRIBUTOR_CREDITED_EVENT = {
  type: "event",
  name: "Credited",
  inputs: [
    { name: "tokenId", type: "uint256", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
  ],
} as const;

/** Merge Credited(tokenId, amount) rows into tokenId → wei. */
export function mergeCreditedAmounts(
  rows: ReadonlyArray<{ tokenId: number; amount: bigint }>,
): Map<number, bigint> {
  const map = new Map<number, bigint>();
  for (const row of rows) {
    if (!Number.isInteger(row.tokenId) || row.tokenId <= 0) continue;
    if (row.amount <= 0n) continue;
    map.set(row.tokenId, (map.get(row.tokenId) ?? 0n) + row.amount);
  }
  return map;
}

export function parseCreditedLogsFromReceipt(logs: readonly Log[]): Map<number, bigint> {
  const rows: { tokenId: number; amount: bigint }[] = [];
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: [DISTRIBUTOR_CREDITED_EVENT],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Credited") continue;
      rows.push({
        tokenId: Number(decoded.args.tokenId),
        amount: decoded.args.amount as bigint,
      });
    } catch {
      /* not a Credited log */
    }
  }
  return mergeCreditedAmounts(rows);
}

/**
 * Load per-token credits minted in the DaySettled(day) transaction.
 * Returns empty map when the day is not settled / logs unavailable.
 */
export async function fetchDaySettlementCredits(input: {
  publicClient: PublicClient;
  game: Address;
  distributor: Address;
  day: number;
  fromBlock: bigint;
}): Promise<{
  settleTxHash: Hex | null;
  credits: Map<number, bigint>;
}> {
  const { publicClient, game, distributor, day, fromBlock } = input;
  if (!Number.isInteger(day) || day < 0) {
    return { settleTxHash: null, credits: new Map() };
  }

  const settledLogs = await publicClient.getLogs({
    address: game,
    event: DAY_SETTLED_EVENT,
    args: { day: BigInt(day) },
    fromBlock,
    toBlock: "latest",
  });

  const settleLog = settledLogs[settledLogs.length - 1];
  if (!settleLog?.transactionHash) {
    return { settleTxHash: null, credits: new Map() };
  }

  const receipt = await publicClient.getTransactionReceipt({
    hash: settleLog.transactionHash,
  });

  const distLogs = receipt.logs.filter(
    (l) => l.address.toLowerCase() === distributor.toLowerCase(),
  );
  return {
    settleTxHash: settleLog.transactionHash,
    credits: parseCreditedLogsFromReceipt(distLogs),
  };
}
