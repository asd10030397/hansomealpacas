/**
 * Phase 10C-1 — viem PublicClient → V3PosChainPort for Production sync.
 */

import {
  decodeEventLog,
  getAddress,
  parseAbiItem,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import {
  V3_POS_EVENT_FRAGMENTS,
  V3_POS_FACTORY_ABI,
  V3_POS_NPM_ABI,
  V3_POS_POOL_ABI,
} from "@/lib/hansome-score/lp/v3-position-index/abis";
import type { V3PosChainPort } from "@/lib/hansome-score/lp/v3-position-index/sync";

const MINT = parseAbiItem(V3_POS_EVENT_FRAGMENTS.Mint);
const TRANSFER = parseAbiItem(V3_POS_EVENT_FRAGMENTS.Transfer);
const INC = parseAbiItem(V3_POS_EVENT_FRAGMENTS.IncreaseLiquidity);
const POOL_CREATED = parseAbiItem(V3_POS_EVENT_FRAGMENTS.PoolCreated);

const DEFAULT_LOG_SPAN = 80_000n;

/**
 * Known PoolCreated blocks (Phase 10A/10B) — accelerates cold backfill.
 * Never used as lock evidence; discovery still revalidates via Mint/ownerOf.
 */
const KNOWN_POOL_CREATION_BLOCKS: Record<string, number> = {
  // BEER WETH/BEER fee 10000
  "0xc71e763a0a258f266d1481295115ea4f291d95ed": 20913772,
};

function errMsg(e: unknown): string {
  const x = e as { shortMessage?: string; message?: string };
  return String(x?.shortMessage || x?.message || e);
}

export function createV3PosChainPort(
  client: PublicClient,
  opts?: { factory?: string; logSpan?: bigint },
): V3PosChainPort {
  const logSpan = opts?.logSpan ?? DEFAULT_LOG_SPAN;
  const factory = opts?.factory;

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
    async getPoolCreationBlock(poolAddress) {
      const known =
        KNOWN_POOL_CREATION_BLOCKS[poolAddress.toLowerCase()] ??
        KNOWN_POOL_CREATION_BLOCKS[getAddress(poolAddress).toLowerCase()];
      if (known != null) return known;
      if (!factory) return null;
      try {
        // Scan recent factory history in shrinking windows from tip.
        // Prefer PoolCreated filtered by pool address when RPC supports it.
        const head = await client.getBlockNumber();
        const span = 250_000n;
        let to = head;
        for (let i = 0; i < 24 && to > 0n; i++) {
          const from = to > span ? to - span + 1n : 0n;
          try {
            const logs = await client.getLogs({
              address: getAddress(factory),
              event: POOL_CREATED,
              fromBlock: from,
              toBlock: to,
            });
            for (const l of logs) {
              const pool = (l.args as { pool?: string })?.pool;
              if (
                pool &&
                getAddress(pool).toLowerCase() ===
                  getAddress(poolAddress).toLowerCase()
              ) {
                return Number(l.blockNumber);
              }
            }
          } catch {
            /* try earlier window / smaller later */
          }
          if (from === 0n) break;
          to = from - 1n;
        }
        return null;
      } catch {
        return null;
      }
    },
    async getLogsMint({ pool, fromBlock, toBlock }) {
      const out: {
        blockNumber: number;
        txHash: string;
        tickLower: number;
        tickUpper: number;
        amountL: string;
        sender: string;
        owner: string;
      }[] = [];
      let from = BigInt(fromBlock);
      const to = BigInt(toBlock);
      while (from <= to) {
        const end = from + logSpan - 1n > to ? to : from + logSpan - 1n;
        try {
          const logs = await client.getLogs({
            address: getAddress(pool),
            event: MINT,
            fromBlock: from,
            toBlock: end,
          });
          for (const l of logs) {
            out.push({
              blockNumber: Number(l.blockNumber),
              txHash: l.transactionHash,
              tickLower: Number(l.args.tickLower),
              tickUpper: Number(l.args.tickUpper),
              amountL: String(l.args.amount),
              sender: String(l.args.sender),
              owner: String(l.args.owner),
            });
          }
        } catch (e) {
          if (end - from > 5_000n) {
            const mid = from + (end - from) / 2n;
            const left = await this.getLogsMint!({
              pool,
              fromBlock: Number(from),
              toBlock: Number(mid),
            });
            const right = await this.getLogsMint!({
              pool,
              fromBlock: Number(mid + 1n),
              toBlock: Number(end),
            });
            out.push(...left, ...right);
          } else {
            throw e;
          }
        }
        from = end + 1n;
      }
      return out;
    },
    async getReceiptNpmEvents({ txHash, npm }) {
      try {
        const receipt = await client.getTransactionReceipt({
          hash: txHash as Hex,
        });
        if (!receipt) {
          return { transfers: [], increaseLiquidity: [], missing: true };
        }
        const transfers: {
          tokenId: string;
          from: string;
          to: string;
          logIndex: number;
        }[] = [];
        const increaseLiquidity: {
          tokenId: string;
          liquidity: string;
          logIndex: number;
        }[] = [];
        let li = 0;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== npm.toLowerCase()) continue;
          try {
            const d = decodeEventLog({
              abi: [TRANSFER],
              data: log.data,
              topics: log.topics,
            });
            if (d.eventName === "Transfer") {
              transfers.push({
                tokenId: String(d.args.tokenId),
                from: getAddress(d.args.from as Address),
                to: getAddress(d.args.to as Address),
                logIndex: li++,
              });
              continue;
            }
          } catch {
            /* not Transfer */
          }
          try {
            const d = decodeEventLog({
              abi: [INC],
              data: log.data,
              topics: log.topics,
            });
            if (d.eventName === "IncreaseLiquidity") {
              increaseLiquidity.push({
                tokenId: String(d.args.tokenId),
                liquidity: String(d.args.liquidity),
                logIndex: li++,
              });
            }
          } catch {
            /* ignore */
          }
        }
        return { transfers, increaseLiquidity, missing: false };
      } catch {
        return { transfers: [], increaseLiquidity: [], missing: true };
      }
    },
    async readPositions({ npm, tokenId }) {
      try {
        const row = (await client.readContract({
          address: getAddress(npm),
          abi: V3_POS_NPM_ABI,
          functionName: "positions",
          args: [BigInt(tokenId)],
        })) as readonly unknown[];
        return {
          token0: getAddress(row[2] as Address),
          token1: getAddress(row[3] as Address),
          fee: Number(row[4]),
          tickLower: Number(row[5]),
          tickUpper: Number(row[6]),
          liquidity: String(row[7]),
        };
      } catch (e) {
        const msg = errMsg(e);
        if (/revert|invalid|nonexistent|ERC721/i.test(msg)) return null;
        return "error";
      }
    },
    async readOwnerOf({ npm, tokenId }) {
      try {
        const owner = await client.readContract({
          address: getAddress(npm),
          abi: V3_POS_NPM_ABI,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        });
        return { ok: true as const, owner: getAddress(owner as Address) };
      } catch (e) {
        const msg = errMsg(e);
        if (/revert|invalid|nonexistent|ERC721/i.test(msg)) {
          return { ok: false as const, revert: true, error: msg.slice(0, 200) };
        }
        return { ok: false as const, revert: false, error: msg.slice(0, 200) };
      }
    },
    async getCodeSize(address) {
      try {
        const code = await client.getBytecode({
          address: getAddress(address),
        });
        if (!code || code === "0x") return 0;
        return Math.max(0, (code.length - 2) / 2);
      } catch {
        return null;
      }
    },
    async readSlot0Tick(pool) {
      try {
        const slot0 = (await client.readContract({
          address: getAddress(pool),
          abi: V3_POS_POOL_ABI,
          functionName: "slot0",
        })) as readonly unknown[];
        return Number(slot0[1]);
      } catch {
        return null;
      }
    },
  };
}

export async function readPoolCanonicalKey(
  client: PublicClient,
  poolAddress: string,
): Promise<{
  token0: Address;
  token1: Address;
  fee: number;
} | null> {
  try {
    const pool = getAddress(poolAddress) as Address;
    const [token0, token1, fee] = await Promise.all([
      client.readContract({
        address: pool,
        abi: V3_POS_POOL_ABI,
        functionName: "token0",
      }) as Promise<Address>,
      client.readContract({
        address: pool,
        abi: V3_POS_POOL_ABI,
        functionName: "token1",
      }) as Promise<Address>,
      client.readContract({
        address: pool,
        abi: V3_POS_POOL_ABI,
        functionName: "fee",
      }) as Promise<number>,
    ]);
    return {
      token0: getAddress(token0),
      token1: getAddress(token1),
      fee: Number(fee),
    };
  } catch {
    return null;
  }
}

export async function readPoolSlot0(
  client: PublicClient,
  poolAddress: string,
): Promise<{ tick: number; sqrtPriceX96: bigint } | null> {
  try {
    const slot0 = (await client.readContract({
      address: getAddress(poolAddress),
      abi: V3_POS_POOL_ABI,
      functionName: "slot0",
    })) as readonly unknown[];
    return {
      sqrtPriceX96: BigInt(slot0[0] as bigint),
      tick: Number(slot0[1]),
    };
  } catch {
    return null;
  }
}

export { V3_POS_FACTORY_ABI };
