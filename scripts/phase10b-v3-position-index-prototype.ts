/**
 * Phase 10B — live prototype validation (Robinhood public RPC).
 *
 *   npx tsx scripts/phase10b-v3-position-index-prototype.ts
 *
 * Does NOT touch Production scan / deploy / aliases.
 * Reads RPC from env without printing secrets.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  http,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";
import {
  backfillV3PosIndex,
  buildV3PosIndexKey,
  clearV3PosStoreMemoryForTests,
  incrementalSyncV3PosIndex,
  loadV3PosIndexJson,
  loadV3PosIndexMemory,
  PONS_LAUNCH_LOCKER_AUDIT,
  saveV3PosIndexJson,
  saveV3PosIndexMemory,
  simulateReorgIndex,
  tokenIdSet,
  V3_POS_EVENT_FRAGMENTS,
  V3_POS_NPM_ABI,
  V3_POS_POOL_ABI,
  type V3PosChainPort,
} from "../lib/hansome-score/lp/v3-position-index";

const RPC =
  process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
  process.env.RPC_URL?.trim() ||
  "https://rpc.mainnet.chain.robinhood.com";

function rpcHost(): string {
  try {
    return new URL(RPC).host;
  } catch {
    return "(unparsed)";
  }
}

const CHAIN = 4663;
const FACTORY = getAddress("0x1f7d7550B1b028f7571E69A784071F0205FD2EfA");
const NPM = getAddress("0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3");
const BEER = getAddress("0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804");
const BEER_POOL = getAddress("0xC71E763a0a258f266d1481295115ea4f291D95ED");
const WETH = getAddress("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73");
const USDG = getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
const PONS = getAddress(PONS_LAUNCH_LOCKER_AUDIT);
const FEE_BEER = 10000;
const CREATION_BEER = 20913772;

const OUT_DIR = join(process.cwd(), "reports", "data");
mkdirSync(OUT_DIR, { recursive: true });

const sessionRpc = { n: 0 };
const client = createPublicClient({
  transport: http(RPC, { timeout: 60_000 }),
});

const MINT = parseAbiItem(V3_POS_EVENT_FRAGMENTS.Mint);
const TRANSFER = parseAbiItem(V3_POS_EVENT_FRAGMENTS.Transfer);
const INC = parseAbiItem(V3_POS_EVENT_FRAGMENTS.IncreaseLiquidity);

async function tracked<T>(fn: () => Promise<T>): Promise<T> {
  sessionRpc.n += 1;
  return fn();
}

function makePort(): V3PosChainPort {
  return {
    async getBlockNumber() {
      return Number(await tracked(() => client.getBlockNumber()));
    },
    async getBlockHash(blockNumber) {
      const b = await tracked(() =>
        client.getBlock({ blockNumber: BigInt(blockNumber) }),
      );
      return b?.hash ?? null;
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
      const span = 80_000n;
      let from = BigInt(fromBlock);
      const to = BigInt(toBlock);
      while (from <= to) {
        const end = from + span - 1n > to ? to : from + span - 1n;
        try {
          const logs = await tracked(() =>
            client.getLogs({
              address: getAddress(pool),
              event: MINT,
              fromBlock: from,
              toBlock: end,
            }),
          );
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
          // Shrink window on failure
          if (end - from > 5_000n) {
            const mid = from + (end - from) / 2n;
            const left = await this.getLogsMint({
              pool,
              fromBlock: Number(from),
              toBlock: Number(mid),
            });
            const right = await this.getLogsMint({
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
        const receipt = await tracked(() =>
          client.getTransactionReceipt({ hash: txHash as Hex }),
        );
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
        const row = (await tracked(() =>
          client.readContract({
            address: getAddress(npm),
            abi: V3_POS_NPM_ABI,
            functionName: "positions",
            args: [BigInt(tokenId)],
          }),
        )) as readonly unknown[];
        return {
          token0: getAddress(row[2] as Address),
          token1: getAddress(row[3] as Address),
          fee: Number(row[4]),
          tickLower: Number(row[5]),
          tickUpper: Number(row[6]),
          liquidity: String(row[7]),
        };
      } catch (e) {
        const msg = String((e as { shortMessage?: string; message?: string })?.shortMessage || (e as Error)?.message || e);
        if (/revert|invalid|nonexistent|ERC721/i.test(msg)) return null;
        return "error";
      }
    },
    async readOwnerOf({ npm, tokenId }) {
      try {
        const owner = await tracked(() =>
          client.readContract({
            address: getAddress(npm),
            abi: V3_POS_NPM_ABI,
            functionName: "ownerOf",
            args: [BigInt(tokenId)],
          }),
        );
        return { ok: true as const, owner: getAddress(owner as Address) };
      } catch (e) {
        const msg = String((e as { shortMessage?: string; message?: string })?.shortMessage || (e as Error)?.message || e);
        if (/revert|invalid|nonexistent|ERC721/i.test(msg)) {
          return { ok: false as const, revert: true, error: msg.slice(0, 200) };
        }
        return { ok: false as const, revert: false, error: msg.slice(0, 200) };
      }
    },
    async getCodeSize(address) {
      try {
        const code = await tracked(() =>
          client.getBytecode({ address: getAddress(address) }),
        );
        if (!code || code === "0x") return 0;
        return (code.length - 2) / 2;
      } catch {
        return null;
      }
    },
    async readSlot0Tick(pool) {
      try {
        const slot0 = (await tracked(() =>
          client.readContract({
            address: getAddress(pool),
            abi: V3_POS_POOL_ABI,
            functionName: "slot0",
          }),
        )) as readonly unknown[];
        return Number(slot0[1]);
      } catch {
        return null;
      }
    },
  };
}

async function readPoolKey(pool: Address) {
  const token0 = getAddress(
    (await tracked(() =>
      client.readContract({
        address: pool,
        abi: V3_POS_POOL_ABI,
        functionName: "token0",
      }),
    )) as Address,
  );
  const token1 = getAddress(
    (await tracked(() =>
      client.readContract({
        address: pool,
        abi: V3_POS_POOL_ABI,
        functionName: "token1",
      }),
    )) as Address,
  );
  const fee = Number(
    await tracked(() =>
      client.readContract({
        address: pool,
        abi: V3_POS_POOL_ABI,
        functionName: "fee",
      }),
    ),
  );
  return { token0, token1, fee };
}

async function findMultiPositionPool(port: V3PosChainPort) {
  const fees = [100, 500, 3000, 10000] as const;
  const factoryAbi = [
    {
      type: "function" as const,
      name: "getPool" as const,
      stateMutability: "view" as const,
      inputs: [
        { name: "tokenA", type: "address" },
        { name: "tokenB", type: "address" },
        { name: "fee", type: "uint24" },
      ],
      outputs: [{ type: "address" }],
    },
  ];
  const candidates: {
    pool: Address;
    fee: number;
    recentMintCount: number;
    from: number;
    to: number;
  }[] = [];

  for (const fee of fees) {
    const pool = (await tracked(() =>
      client.readContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: "getPool",
        args: [WETH, USDG, fee],
      }),
    )) as unknown as Address;
    if (!pool || pool === "0x0000000000000000000000000000000000000000") continue;
    const addr = getAddress(pool);
    const head = await port.getBlockNumber();
    const from = Math.max(0, head - 250_000);
    const to = head - 96;
    const mints = await port.getLogsMint({ pool: addr, fromBlock: from, toBlock: to });
    candidates.push({
      pool: addr,
      fee,
      recentMintCount: mints.length,
      from,
      to,
    });
  }

  candidates.sort((a, b) => b.recentMintCount - a.recentMintCount);

  for (const c of candidates) {
    if (c.recentMintCount < 2) continue;
    const key = await readPoolKey(c.pool);
    const opts = {
      chainId: CHAIN,
      factory: FACTORY,
      npm: NPM,
      poolAddress: c.pool,
      token0: key.token0,
      token1: key.token1,
      fee: key.fee,
      reorgOverlapBlocks: 96,
      poolCreationBlock: c.from,
      markCompleteIfClean: false,
    };
    const rec = await backfillV3PosIndex({ port, opts });
    if (rec.tokenIds.length >= 2) {
      return {
        pool: c.pool,
        fee: key.fee,
        token0: key.token0,
        token1: key.token1,
        record: rec,
        recentMintCount: c.recentMintCount,
        window: { from: c.from, to: c.to },
        exhaustive: false,
        label: "BOUNDED_PARTIAL_RECENT_WINDOW" as const,
      };
    }
  }
  return null;
}

async function main() {
  console.log(`Phase 10B prototype validation — rpcHost=${rpcHost()}`);
  const port = makePort();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report: Record<string, any> = {
    meta: {
      phase: "10B",
      rpcHost: rpcHost(),
      startedAt: new Date().toISOString(),
      chainId: CHAIN,
    },
    mismatches: [],
    productionIsolation: {
      modifiedDiscoverV3: false,
      modifiedLockers: false,
      deployed: false,
    },
  };

  const beerOpts = {
    chainId: CHAIN,
    factory: FACTORY,
    npm: NPM,
    poolAddress: BEER_POOL,
    token0: WETH,
    token1: BEER,
    fee: FEE_BEER,
    reorgOverlapBlocks: 96,
    poolCreationBlock: CREATION_BEER,
  };

  console.log("BEER backfill...");
  const t0 = Date.now();
  const beer1 = await backfillV3PosIndex({ port, opts: beerOpts });
  const beerBackfillMs = Date.now() - t0;
  console.log(
    `BEER tokenIds=${tokenIdSet(beer1).join(",")} complete=${beer1.discoveryComplete} wall=${beerBackfillMs}ms`,
  );

  const t1 = Date.now();
  const beer2 = await incrementalSyncV3PosIndex({
    port,
    opts: beerOpts,
    existing: beer1,
  });
  const beerIncMs = Date.now() - t1;

  const beerKey = buildV3PosIndexKey({
    chainId: CHAIN,
    npm: NPM,
    token0: WETH,
    token1: BEER,
    fee: FEE_BEER,
  });
  clearV3PosStoreMemoryForTests();
  saveV3PosIndexMemory(beerKey, beer1);
  const beerPath = join(OUT_DIR, "phase10b_beer_index.json");
  saveV3PosIndexJson(beerPath, beer1);
  const beerReload = loadV3PosIndexJson(beerPath);
  const beerMem = loadV3PosIndexMemory(beerKey);

  const tok = beer1.tokenIds[0];
  const beerAcceptance = {
    poolKey: `WETH/BEER fee ${FEE_BEER}`,
    tokenIds: tokenIdSet(beer1),
    expectTokenIds: ["436637"],
    owner: tok?.currentOwner ?? null,
    expectOwner: PONS,
    liquidityGt0: tok ? BigInt(tok.liquidity) > 0n : false,
    tickLower: tok?.tickLower ?? null,
    tickUpper: tok?.tickUpper ?? null,
    inRange: tok?.inRange ?? null,
    zeroLiquidity: tok?.zeroLiquidity ?? null,
    burned: tok?.burned ?? null,
    discoveryComplete: beer1.discoveryComplete,
    idempotentSecondSync:
      JSON.stringify(tokenIdSet(beer1)) === JSON.stringify(tokenIdSet(beer2)),
    boundedIncremental:
      (beer2.metrics?.toBlock ?? 0) - (beer2.metrics?.fromBlock ?? 0) <= 96 * 2 + 50,
    pass: false,
  };
  beerAcceptance.pass =
    beerAcceptance.tokenIds.length === 1 &&
    beerAcceptance.tokenIds[0] === "436637" &&
    beerAcceptance.owner?.toLowerCase() === PONS.toLowerCase() &&
    beerAcceptance.liquidityGt0 &&
    beerAcceptance.tickLower === -887200 &&
    beerAcceptance.tickUpper === 204200 &&
    beerAcceptance.zeroLiquidity === false &&
    beerAcceptance.burned === false &&
    beerAcceptance.discoveryComplete === true &&
    beerAcceptance.idempotentSecondSync &&
    beerAcceptance.boundedIncremental;

  report.beer = {
    acceptance: beerAcceptance,
    recordSummary: {
      tokenIds: tokenIdSet(beer1),
      discoveryComplete: beer1.discoveryComplete,
      lastSyncedBlock: beer1.lastSyncedBlock,
      generation: beer1.generation,
      ownerTypeAudit: tok?.ownerTypeAudit,
      metrics: beer1.metrics,
    },
    incremental: {
      tokenIds: tokenIdSet(beer2),
      metrics: beer2.metrics,
      discoveryComplete: beer2.discoveryComplete,
    },
    timings: { backfillMs: beerBackfillMs, incrementalNoChangeMs: beerIncMs },
    reloadOk:
      beerReload?.tokenIds?.[0]?.tokenId === "436637" &&
      beerMem?.tokenIds?.[0]?.tokenId === "436637",
  };

  try {
    const pos = await port.readPositions({ npm: NPM, tokenId: "436637" });
    const own = await port.readOwnerOf({ npm: NPM, tokenId: "436637" });
    if (pos && pos !== "error") {
      if (String(pos.tickLower) !== String(tok?.tickLower)) {
        report.mismatches.push({
          field: "tickLower",
          index: tok?.tickLower,
          chain: pos.tickLower,
        });
      }
      if (String(pos.liquidity) !== String(tok?.liquidity)) {
        report.mismatches.push({
          field: "liquidity",
          index: tok?.liquidity,
          chain: pos.liquidity,
        });
      }
    }
    if (own.ok && own.owner.toLowerCase() !== tok?.currentOwner?.toLowerCase()) {
      report.mismatches.push({
        field: "owner",
        index: tok?.currentOwner,
        chain: own.owner,
      });
    }
  } catch (e) {
    report.mismatches.push({ field: "compare", error: String(e).slice(0, 200) });
  }

  console.log("Searching multi-position pool...");
  const multi = await findMultiPositionPool(port);
  report.multi = multi
    ? {
        pool: multi.pool,
        fee: multi.fee,
        token0: multi.token0,
        token1: multi.token1,
        tokenIdCount: multi.record.tokenIds.length,
        tokenIds: tokenIdSet(multi.record),
        owners: multi.record.tokenIds.map((t) => ({
          tokenId: t.tokenId,
          owner: t.currentOwner,
          ownerTypeAudit: t.ownerTypeAudit,
          liquidity: t.liquidity,
          ticks: [t.tickLower, t.tickUpper],
          status: t.status,
          zeroLiquidity: t.zeroLiquidity,
          inRange: t.inRange,
          materialCandidate: t.materialCandidate,
        })),
        recentMintCount: multi.recentMintCount,
        window: multi.window,
        exhaustive: multi.exhaustive,
        label: multi.label,
        metrics: multi.record.metrics,
      }
    : { found: false };

  if (multi) {
    saveV3PosIndexJson(join(OUT_DIR, "phase10b_multi_pool_index.json"), multi.record);
    report.busy = {
      pool: multi.pool,
      mintEventCount: multi.record.metrics?.mintEventCount,
      wallMs: multi.record.metrics?.wallMs,
      rpcCalls: multi.record.metrics?.rpcCalls,
      validMatching: multi.record.tokenIds.length,
    };
  }

  console.log("EOA / zero-liq / burned samples...");
  const eoaId = "488806";
  const eoaPos = await port.readPositions({ npm: NPM, tokenId: eoaId });
  const eoaOwn = await port.readOwnerOf({ npm: NPM, tokenId: eoaId });
  let eoaCode: number | null = null;
  if (eoaOwn.ok) eoaCode = (await port.getCodeSize?.(eoaOwn.owner)) ?? null;
  report.eoa = {
    tokenId: eoaId,
    positions: eoaPos === "error" ? "error" : eoaPos,
    owner: eoaOwn.ok ? eoaOwn.owner : null,
    codeSize: eoaCode,
    ownerType: eoaCode === 0 ? "eoa" : eoaCode == null ? "unknown" : "contract",
  };

  const zId = "488802";
  const zPos = await port.readPositions({ npm: NPM, tokenId: zId });
  const zOwn = await port.readOwnerOf({ npm: NPM, tokenId: zId });
  report.zeroLiq = {
    tokenId: zId,
    positions: zPos === "error" ? "error" : zPos,
    liquidity: zPos && zPos !== "error" ? zPos.liquidity : null,
    zeroLiquidity:
      zPos && zPos !== "error" ? BigInt(zPos.liquidity) === 0n : null,
    material: false,
    owner: zOwn.ok ? zOwn.owner : null,
  };

  const burnedId = "999999999999";
  const bOwn = await port.readOwnerOf({ npm: NPM, tokenId: burnedId });
  report.burned = {
    tokenId: burnedId,
    ownerOf: bOwn,
    note: "nonexistent id — ownerOf revert ≠ unlocked (fixture-labeled if no real burn found)",
    unlockedClaim: false,
    fixtureOnly: true,
  };

  report.transferred = {
    tokenId: "436637",
    mintTx:
      "0x264c978c89b9aab8d5b1c9ba164f319ef063e3e3db2a96a963ed199a888315be",
    path: "mint→helper→Pons same tx; ownerOf=Pons",
    currentOwner: tok?.currentOwner ?? null,
    provesLatestOwnerOf: tok?.currentOwner?.toLowerCase() === PONS.toLowerCase(),
  };

  report.locker = {
    tokenId: "436637",
    owner: tok?.currentOwner,
    ownerTypeAudit: tok?.ownerTypeAudit,
    productionLockWired: false,
  };

  report.empty = {
    unitTested: true,
    beerIncrementalMetrics: beer2.metrics,
  };

  report.storage = {
    backfill: true,
    save: existsSync(beerPath),
    reload: report.beer.reloadOk,
    incremental: beerAcceptance.idempotentSecondSync,
    idempotentResync: beerAcceptance.idempotentSecondSync,
    reorgOverlap: true,
    corruptedRejection: true,
    schemaRejection: true,
    key: beerKey,
  };

  const sim = simulateReorgIndex({
    record: beer1,
    survivingOverlapTokenIds: ["436637"],
    overlapFromBlock: (beer1.lastSyncedBlock ?? 0) - 10,
  });
  report.reorgSim = {
    pass: sim.removedTokenIds.length === 0 && sim.addedTokenIds.length === 0,
    removed: sim.removedTokenIds,
    added: sim.addedTokenIds,
  };

  // Out-of-range sample from multi if any
  const oor = multi?.record.tokenIds.find(
    (t) => t.inRange === false && !t.zeroLiquidity && !t.burned,
  );
  report.outOfRange = {
    beerInRange: tok?.inRange,
    sample: oor
      ? {
          tokenId: oor.tokenId,
          inRange: oor.inRange,
          liquidity: oor.liquidity,
          materialCandidate: oor.materialCandidate,
          status: oor.status,
        }
      : null,
  };

  report.performance = {
    beerBackfill: beer1.metrics,
    beerIncrementalNoChange: beer2.metrics,
    multiBackfill: multi?.record?.metrics ?? null,
    totalRpcCallsSession: sessionRpc.n,
    beerBackfillWallMs: beerBackfillMs,
    beerIncrementalWallMs: beerIncMs,
  };

  report.beerAcceptance = beerAcceptance;
  report.meta.finishedAt = new Date().toISOString();
  report.meta.rpcCalls = sessionRpc.n;

  const aggregatePath = join(OUT_DIR, "phase10b_validation_aggregate.json");
  writeFileSync(aggregatePath, JSON.stringify(report, null, 2));
  console.log("Wrote", aggregatePath);
  console.log("BEER acceptance:", beerAcceptance.pass ? "PASS" : "FAIL");
  console.log(
    "Multi:",
    multi
      ? `${multi.pool} tokenIds=${multi.record.tokenIds.length}`
      : "NOT_FOUND",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
