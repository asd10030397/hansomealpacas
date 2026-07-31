/**
 * viem PublicClient → HookPosChainPort
 */

import {
  getAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { STATE_VIEW_ADDRESS } from "@/lib/chain";
import {
  MODIFY_LIQUIDITY_TOPIC0,
  STATE_VIEW_POSITION_ABI,
} from "@/lib/hansome-score/lp/hook-position-index/abis";
import { normalizeBytes32 } from "@/lib/hansome-score/lp/hook-position-index/decode";
import type { HookPosChainPort } from "@/lib/hansome-score/lp/hook-position-index/sync";
import type { RawLogLike } from "@/lib/hansome-score/lp/hook-position-index/types";

function senderTopic(address: string): Hex {
  return normalizeBytes32(
    `0x${getAddress(address).slice(2).toLowerCase().padStart(64, "0")}`,
  );
}

export function createHookPosChainPort(
  client: PublicClient,
): HookPosChainPort {
  return {
    async getBlockNumber() {
      return Number(await client.getBlockNumber());
    },
    async getBlockHash(blockNumber) {
      try {
        const b = await client.getBlock({ blockNumber: BigInt(blockNumber) });
        return b?.hash ?? null;
      } catch {
        return null;
      }
    },
    async getTransactionReceipt(txHash) {
      try {
        const receipt = await client.getTransactionReceipt({
          hash: txHash as Hex,
        });
        if (!receipt) return null;
        return {
          blockNumber: Number(receipt.blockNumber),
          logs: receipt.logs.map(
            (l): RawLogLike => ({
              address: l.address,
              topics: l.topics as string[],
              data: l.data,
              blockNumber: l.blockNumber,
              transactionHash: l.transactionHash,
              logIndex: l.logIndex,
            }),
          ),
        };
      } catch {
        return null;
      }
    },
    async getLogsModifyLiquidity({
      poolManager,
      poolId,
      fromBlock,
      toBlock,
      sender,
    }) {
      // viem getLogs typing is strict; use request + client-side verify.
      const topics: (Hex | null)[] = [
        MODIFY_LIQUIDITY_TOPIC0,
        normalizeBytes32(poolId),
        sender ? senderTopic(sender) : null,
      ];
      const logs = (await client.request({
        method: "eth_getLogs",
        params: [
          {
            address: getAddress(poolManager),
            fromBlock: `0x${BigInt(fromBlock).toString(16)}` as Hex,
            toBlock: `0x${BigInt(toBlock).toString(16)}` as Hex,
            topics,
          },
        ],
      })) as Array<{
        address: string;
        topics: string[];
        data: string;
        blockNumber: string;
        transactionHash: string;
        logIndex: string;
      }>;
      return logs.map(
        (l): RawLogLike => ({
          address: l.address,
          topics: l.topics,
          data: l.data,
          blockNumber: l.blockNumber,
          transactionHash: l.transactionHash,
          logIndex: l.logIndex,
        }),
      );
    },
    async getPositionInfo({ poolId, owner, tickLower, tickUpper, salt }) {
      try {
        const result = await client.readContract({
          address: STATE_VIEW_ADDRESS as Address,
          abi: STATE_VIEW_POSITION_ABI,
          functionName: "getPositionInfo",
          args: [
            normalizeBytes32(poolId),
            getAddress(owner) as Address,
            tickLower,
            tickUpper,
            normalizeBytes32(salt),
          ],
        });
        const liquidity = (result as readonly [bigint, bigint, bigint])[0];
        return { liquidity: liquidity.toString() };
      } catch {
        return null;
      }
    },
  };
}
