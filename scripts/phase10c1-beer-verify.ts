/**
 * Phase 10C-1 — live BEER discovery verification (public RPC).
 *   npx tsx scripts/phase10c1-beer-verify.ts
 */

import { createPublicClient, getAddress, http } from "viem";
import { discoverV3Liquidity } from "../lib/hansome-score/lp/adapters/v3";
import { V3_LOCKER_ADAPTERS } from "../lib/hansome-score/lp/lockers";
import {
  clearV3PosProductionMemoryForTests,
  resolveMaterialV3PoolPositions,
} from "../lib/hansome-score/lp/v3-position-index";

const RPC =
  process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
  process.env.RPC_URL?.trim() ||
  "https://rpc.mainnet.chain.robinhood.com";

const BEER = getAddress("0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804");
const POOL = getAddress("0xC71E763a0a258f266d1481295115ea4f291D95ED");
const PONS = getAddress("0x736D76699C26D0d966744cAe304C000d471f7F35");

async function main() {
  clearV3PosProductionMemoryForTests();
  const client = createPublicClient({
    transport: http(RPC, { timeout: 60_000 }),
  });

  console.log("adapters", V3_LOCKER_ADAPTERS.length);
  console.log("rpc_host", new URL(RPC).host);

  const t0 = Date.now();
  const coldPool = await resolveMaterialV3PoolPositions({
    client: client as never,
    poolAddress: POOL,
    fee: 10000,
    allowInlineBackfill: true,
    poolCreationBlock: 20913772,
    interactiveBudgetMs: 120_000,
  });
  const coldMs = Date.now() - t0;
  console.log(
    JSON.stringify(
      {
        coldMs,
        positionDiscoveryComplete: coldPool.positionDiscoveryComplete,
        tokenIds: coldPool.positions.map((p) => p.positionNftId),
        owner: coldPool.positions[0]?.owner,
        ticks: [
          coldPool.positions[0]?.tickLower,
          coldPool.positions[0]?.tickUpper,
        ],
        liquidity: coldPool.positions[0]?.liquidity,
        lockState: coldPool.positions[0]?.lockState,
        progress: coldPool.progressActions,
      },
      null,
      2,
    ),
  );

  const t1 = Date.now();
  const warm = await discoverV3Liquidity({
    tokenAddress: BEER,
    client: client as never,
    allowInlineV3PosBackfill: false,
    interactiveV3PosBudgetMs: 15_000,
  });
  const warmMs = Date.now() - t1;

  const numeric = warm.positions.filter(
    (p) => !p.positionNftId.startsWith("v3-pool:"),
  );
  console.log(
    JSON.stringify(
      {
        warmMs,
        positionDiscoveryComplete: warm.positionDiscoveryComplete,
        lockAnalysisComplete: warm.lockAnalysisComplete,
        numericIds: numeric.map((p) => p.positionNftId),
        owner: numeric[0]?.owner,
        ticks: [numeric[0]?.tickLower, numeric[0]?.tickUpper],
        liquidity: numeric[0]?.liquidity,
        lockState: numeric[0]?.lockState,
        stubOnly: warm.positions.every((p) =>
          p.positionNftId.startsWith("v3-pool:"),
        ),
        ownerMatchesPons:
          numeric[0]?.owner?.toLowerCase() === PONS.toLowerCase(),
        detail: warm.detail,
      },
      null,
      2,
    ),
  );

  const pass =
    numeric.some((p) => p.positionNftId === "436637") &&
    numeric[0]?.owner?.toLowerCase() === PONS.toLowerCase() &&
    numeric[0]?.tickLower === -887200 &&
    numeric[0]?.tickUpper === 204200 &&
    numeric[0]?.lockState === "UNABLE_TO_DETERMINE" &&
    warm.positionDiscoveryComplete === true &&
    warm.lockAnalysisComplete === false &&
    V3_LOCKER_ADAPTERS.length === 0;

  console.log(pass ? "BEER_VERIFY_PASS" : "BEER_VERIFY_FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
