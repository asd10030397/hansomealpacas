import { Contract, type JsonRpcProvider } from "ethers";
import { erc20Abi } from "./chain/erc20Abi";
import { config } from "./config";
import { createLogger } from "./logger";
import type { BotDatabase } from "./database";

const logger = createLogger("holders");

/**
 * "New holder" v1 definition: the buyer's on-chain HANSOME balance was
 * exactly zero the block *before* this swap. This is a genuine on-chain
 * check (one extra `balanceOf` call at a historical block), not a
 * third-party API — consistent with the requirement that buy/sell
 * detection never depends on external services. It's a pragmatic
 * approximation (an address could have held and fully exited before, and
 * would count as "new" again) rather than a full lifetime-holder ledger,
 * which would require indexing every Transfer since deployment.
 */
export async function checkIsNewHolder(
  provider: JsonRpcProvider,
  db: BotDatabase,
  traderAddress: string,
  blockNumber: number,
): Promise<boolean> {
  if (db.isKnownHolder(traderAddress)) return false;

  try {
    const token = new Contract(config.chain.tokenAddress, erc20Abi, provider);
    const priorBlock = Math.max(blockNumber - 1, 0);
    const balanceBefore: bigint = await token.balanceOf(traderAddress, { blockTag: priorBlock });
    return balanceBefore === 0n;
  } catch (error) {
    logger.warn(`New-holder check failed for ${traderAddress} — defaulting to false`, error);
    return false;
  }
}

let cachedHolderCount: { value: number; at: number } | null = null;
const HOLDER_COUNT_CACHE_MS = 5 * 60 * 1000;

/**
 * Best-effort total holder count via Blockscout's public v2 API. This is
 * explicitly approximate/supplementary (shown in /status), never used for
 * buy/sell detection, and degrades to `null` if Blockscout is unavailable
 * or the endpoint shape changes.
 */
export async function fetchTotalHoldersBestEffort(): Promise<number | null> {
  const now = Date.now();
  if (cachedHolderCount && now - cachedHolderCount.at < HOLDER_COUNT_CACHE_MS) {
    return cachedHolderCount.value;
  }

  try {
    const url = `${config.chain.explorerBaseUrl}/api/v2/tokens/${config.chain.tokenAddress}/counters`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Blockscout HTTP ${response.status}`);

    const json = (await response.json()) as { token_holders_count?: string | number };
    const value = Number(json.token_holders_count);
    if (!Number.isFinite(value)) throw new Error("response missing token_holders_count");

    cachedHolderCount = { value, at: now };
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logger.warn(`Total holders lookup failed (best-effort, non-fatal): ${message}`);
    return cachedHolderCount?.value ?? null;
  }
}
