import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  isHex,
  keccak256,
  toBytes,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnetChain, ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import { hansomeGameAbi } from "@/lib/game/abis/hansomeGame";
import { gameRandomnessAbi } from "@/lib/game/abis/gameRandomness";
import {
  GAME_CHAIN_ID,
  HANSOME_GAME_ADDRESS,
} from "@/lib/game/hansomeGame";
import {
  listVaultSecretsForDay,
  vaultSecretCountForDay,
} from "@/lib/game/server/testnetCommitVault";
import {
  buildTestnetResolveStatus,
  readRelayerPrivateKey,
  RELAYER_NOT_CONFIGURED_CODE,
  relayerUnavailableMessage,
} from "@/lib/game/server/testnetRelayerStatus";
import { SettlementTimingTrace } from "@/lib/game/server/settlementTimingLog";
import { writeRelayerContract } from "@/lib/game/server/testnetRelayerWrite";
import { isDefinitelyAlreadyRevealed } from "@/lib/game/homeRevealGuard";
import {
  stageFromResolveFlags,
  type TestnetResolveStage,
  type TestnetResolveTimings,
} from "@/lib/game/testnetResolveStages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function msSince(start: number): number {
  return Math.round(performance.now() - start);
}

/** Last resolve request end time per day — poll-gap diagnostics (server process). */
const lastResolveEndByDay = new Map<number, number>();

type RevealItem = {
  tokenId: number;
  locationId: number;
  salt: string;
};

type Body = {
  day?: number;
  /** Optional client reveals — vault secrets are preferred / merged. */
  reveals?: RevealItem[];
  fulfillSeed?: boolean;
  settle?: boolean;
};

// GameTypes.DayState
const REVEAL_OPEN = 3;
const REVEAL_CLOSED = 4;
const CLAIMABLE = 6;
/** Must match HansomeGame.MAX_REVEAL_BATCH / MAX_CREDIT_BATCH. */
const MAX_REVEAL_BATCH = 50;
const MAX_CREDIT_BATCH = 50;
/** Credits per poll after battle is already ready (background progress). */
const MAX_CREDIT_LOOPS = 32;
/**
 * When this request just ran finalizeDay, return immediately so the client can
 * show Battle Result. Credits continue on subsequent polls.
 */
const CREDIT_LOOPS_AFTER_FRESH_FINALIZE = 0;

/** Count Revealed events in a reveal tx (Home cannot be verified via locationOf). */
async function countRevealedInTx(
  publicClient: PublicClient,
  game: Address,
  txHash: Hex,
  tokenIds: number[],
): Promise<number> {
  const want = new Set(tokenIds);
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  let n = 0;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== game.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: hansomeGameAbi,
        data: log.data,
        topics: log.topics,
      });
      if (
        decoded.eventName === "Revealed" &&
        want.has(Number(decoded.args.tokenId))
      ) {
        n += 1;
      }
    } catch {
      /* not Revealed */
    }
  }
  return n;
}

function rpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GAME_RPC_URL?.trim() ||
    process.env.GAME_RPC_URL?.trim() ||
    robinhoodTestnetChain.rpcUrls.default.http[0]
  );
}

function isAlreadySettledError(message: string): boolean {
  return /AlreadySettled/i.test(message);
}

function isSeedAlreadySetError(message: string): boolean {
  return (
    /SeedAlreadySet/i.test(message) ||
    // GameRandomness.SeedAlreadySet() — viem may not decode without ABI error.
    /0xbf136bb2/i.test(message)
  );
}

function isIdempotentResolveError(message: string): boolean {
  return isAlreadySettledError(message) || isSeedAlreadySetError(message);
}

export async function POST(req: Request) {
  if (GAME_CHAIN_ID !== ROBINHOOD_TESTNET_CHAIN_ID) {
    return NextResponse.json(
      {
        ok: false,
        enabled: false,
        error: "Gasless resolve is Testnet-only.",
      },
      { status: 403 },
    );
  }

  const flag = process.env.NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE?.trim();
  if (flag === "0" || flag === "false") {
    return NextResponse.json(
      { ok: false, enabled: false, error: "Gasless resolve disabled." },
      { status: 403 },
    );
  }

  if (!HANSOME_GAME_ADDRESS) {
    return NextResponse.json(
      { ok: false, enabled: false, error: "HansomeGame address not configured." },
      { status: 500 },
    );
  }

  const pk = readRelayerPrivateKey();
  if (!pk) {
    console.info(
      "[settlement-timing]",
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "relayer_not_configured",
        ok: false,
      }),
    );
    return NextResponse.json(
      {
        ok: false,
        enabled: true,
        relayerConfigured: false,
        canResolve: false,
        code: RELAYER_NOT_CONFIGURED_CODE,
        error: relayerUnavailableMessage(),
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, enabled: true, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const day = Number(body.day);
  if (!Number.isInteger(day) || day < 0) {
    return NextResponse.json(
      { ok: false, enabled: true, error: "Invalid day." },
      { status: 400 },
    );
  }

  const fulfillSeed = body.fulfillSeed !== false;
  const settle = body.settle === true;
  const timing = new SettlementTimingTrace(day);
  const prevEnd = lastResolveEndByDay.get(day);
  const pollGapMs =
    prevEnd != null ? Math.round(performance.now() - prevEnd) : undefined;
  timing.log("resolve_request_received", {
    stage: "checking",
    pollGapMs,
    detail: `fulfillSeed=${fulfillSeed};settle=${settle}`,
  });
  timing.log("relayer_configured_ok", { ok: true });

  const account = privateKeyToAccount(pk);
  const transport = http(rpcUrl());
  const publicClient = createPublicClient({
    chain: robinhoodTestnetChain,
    transport,
  });
  const walletClient = createWalletClient({
    account,
    chain: robinhoodTestnetChain,
    transport,
  });

  const game = HANSOME_GAME_ADDRESS as Address;
  let revealTxHash: Hex | null = null;
  let seedTxHash: Hex | null = null;
  let settleTxHash: Hex | null = null;
  let revealed = 0;
  let alreadySettled = false;
  let dayFinalized = false;
  let seedSkipped = false;
  let hasSeed: boolean | null = null;
  let seedMs: number | null = null;
  let revealMs: number | null = null;
  let settleMs: number | null = null;
  let creditBatchesRun = 0;
  let revealBatchesRun = 0;
  const tTotal = performance.now();

  const buildTimings = (stage: TestnetResolveStage): TestnetResolveTimings => ({
    totalMs: msSince(tTotal),
    seedMs,
    revealMs,
    settleMs,
    stage,
  });

  const jsonOk = (extra: Record<string, unknown> = {}) => {
    const stage = stageFromResolveFlags({
      alreadySettled,
      finalized: dayFinalized,
      settleTxHash,
      seedTxHash,
      seedSkipped,
      revealed,
      revealTxHash,
      hasSeed,
    });
    const timings = buildTimings(stage);
    if (dayFinalized || alreadySettled) timing.markBattleReady({ stage });
    if (alreadySettled) timing.markFullySettled({ stage });
    timing.summary(stage);
    lastResolveEndByDay.set(day, performance.now());
    console.info("[testnet-resolve]", {
      day,
      stage,
      totalMs: timings.totalMs,
      seedMs,
      revealMs,
      settleMs,
      alreadySettled,
      finalized: dayFinalized,
      revealed,
      revealBatchesRun,
      creditBatchesRun,
      vaultCount: vaultSecretCountForDay(day),
      requestId: timing.requestId,
    });
    const battleReady = dayFinalized || alreadySettled;
    const creditsPending = battleReady && !alreadySettled;
    return NextResponse.json({
      ok: true,
      enabled: true,
      day,
      alreadySettled,
      /** @deprecated use battleReady — true when finalizeDay done. */
      finalized: battleReady,
      battleReady,
      creditsPending,
      fullySettled: alreadySettled,
      seedSkipped,
      revealed,
      revealTxHash,
      seedTxHash,
      settleTxHash,
      vaultCount: vaultSecretCountForDay(day),
      stage,
      timings,
      ...extra,
    });
  };

  try {
    const tRpc0 = performance.now();
    timing.log("rpc_read_start", { stage: "checking", detail: "isSettled" });
    const settledEarly = await publicClient.readContract({
      address: game,
      abi: hansomeGameAbi,
      functionName: "isSettled",
      args: [BigInt(day)],
    });
    timing.log("rpc_read_end", {
      stage: "checking",
      detail: "isSettled",
      rpcMs: msSince(tRpc0),
      ok: true,
    });
    if (settledEarly) {
      alreadySettled = true;
      dayFinalized = true;
      seedSkipped = true;
      hasSeed = true;
      timing.log("skipped_call", {
        stage: "completed",
        skipped: true,
        detail: "already_settled_early",
      });
      return jsonOk();
    }

    const tRand = performance.now();
    const randomness = (await publicClient.readContract({
      address: game,
      abi: hansomeGameAbi,
      functionName: "randomness",
    })) as Address;
    timing.log("rpc_read_end", {
      detail: "randomness",
      rpcMs: msSince(tRand),
    });

    // Parallel initial reads — cut idle RPC round-trips before first write.
    {
      const tSeed = performance.now();
      timing.log("rpc_read_start", {
        stage: "waiting_seed",
        detail: "dayState+hasDaySeed",
      });
      const [dayStateRaw, hasSeedRaw] = await Promise.all([
        publicClient.readContract({
          address: game,
          abi: hansomeGameAbi,
          functionName: "dayState",
          args: [BigInt(day)],
        }),
        publicClient.readContract({
          address: randomness,
          abi: gameRandomnessAbi,
          functionName: "hasDaySeed",
          args: [BigInt(day)],
        }),
      ]);
      timing.log("rpc_read_end", {
        stage: "waiting_seed",
        detail: "dayState+hasDaySeed",
        rpcMs: msSince(tSeed),
      });
      let dayState = Number(dayStateRaw);
      hasSeed = Boolean(hasSeedRaw);
      timing.log("settlement_stage", {
        stage: hasSeed ? "settling" : "waiting_seed",
        detail: `dayState=${dayState};hasSeed=${hasSeed}`,
      });

      // ── 1) Seed: check → fulfill only if needed (idempotent) ──────────
      if (fulfillSeed && !hasSeed && dayState >= REVEAL_OPEN) {
        hasSeed = Boolean(
          await publicClient.readContract({
            address: randomness,
            abi: gameRandomnessAbi,
            functionName: "hasDaySeed",
            args: [BigInt(day)],
          }),
        );
        if (hasSeed) {
          seedSkipped = true;
          seedMs = msSince(tSeed);
        } else {
          const seed = keccak256(
            toBytes(
              `hansome-testnet-seed:${day}:${Date.now()}:${account.address}`,
            ),
          );
          try {
            seedTxHash = await writeRelayerContract({
              publicClient,
              walletClient,
              account,
              address: randomness,
              abi: gameRandomnessAbi,
              functionName: "fulfillDaySeed",
              args: [BigInt(day), seed],
              timing,
              timingLabel: "fulfillDaySeed",
            });
            hasSeed = true;
            seedMs = msSince(tSeed);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!isSeedAlreadySetError(msg)) throw e;
            timing.log("skipped_call", {
              stage: "waiting_seed",
              skipped: true,
              detail: "seed_already_set",
            });
            hasSeed = Boolean(
              await publicClient.readContract({
                address: randomness,
                abi: gameRandomnessAbi,
                functionName: "hasDaySeed",
                args: [BigInt(day)],
              }),
            );
            if (!hasSeed) throw e;
            seedSkipped = true;
            seedTxHash = null;
            seedMs = msSince(tSeed);
          }
        }
      } else if (hasSeed) {
        seedSkipped = true;
        seedMs = msSince(tSeed);
      } else {
        seedMs = msSince(tSeed);
      }

      // ── 2) Reveal (vault + optional client secrets) ───────────────────
      const byToken = new Map<
        number,
        { tokenId: number; locationId: number; salt: Hex }
      >();
      for (const v of listVaultSecretsForDay(day)) {
        byToken.set(v.tokenId, {
          tokenId: v.tokenId,
          locationId: v.locationId,
          salt: v.salt,
        });
      }
      for (const item of Array.isArray(body.reveals) ? body.reveals : []) {
        const tokenId = Number(item.tokenId);
        const locationId = Number(item.locationId);
        const salt = item.salt as Hex;
        if (!Number.isInteger(tokenId) || tokenId < 0) continue;
        if (!Number.isInteger(locationId) || locationId < 0 || locationId > 4) {
          continue;
        }
        if (!isHex(salt) || salt.length !== 66) continue;
        byToken.set(tokenId, { tokenId, locationId, salt });
      }

      // Refresh dayState once after seed (phase can advance while seed mined).
      dayState = Number(
        await publicClient.readContract({
          address: game,
          abi: hansomeGameAbi,
          functionName: "dayState",
          args: [BigInt(day)],
        }),
      );

      if (byToken.size > 0 && dayState === REVEAL_OPEN) {
        const tReveal = performance.now();
        timing.log("reveal_phase_start", {
          stage: "revealing",
          batchSize: byToken.size,
        });
        const entries = [...byToken.values()];
        const locs = await Promise.all(
          entries.map((entry) =>
            publicClient.readContract({
              address: game,
              abi: hansomeGameAbi,
              functionName: "locationOf",
              args: [BigInt(entry.tokenId), BigInt(day)],
            }),
          ),
        );
        const pending: typeof entries = [];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]!;
          const loc = Number(locs[i]);
          if (
            isDefinitelyAlreadyRevealed({
              locationOf: loc,
              commitLocationId: entry.locationId,
            })
          ) {
            revealed += 1;
          } else {
            pending.push(entry);
          }
        }
        timing.log("reveal_pending_count", {
          stage: "revealing",
          batchSize: pending.length,
          detail: `alreadyRevealed=${revealed}`,
        });

        if (pending.length > 0) {
          for (let i = 0; i < pending.length; i += MAX_REVEAL_BATCH) {
            const chunk = pending.slice(i, i + MAX_REVEAL_BATCH);
            const batchIndex = Math.floor(i / MAX_REVEAL_BATCH);
            const tokenIds = chunk.map((r) => BigInt(r.tokenId));
            const locationIds = chunk.map((r) => r.locationId);
            const salts = chunk.map((r) => r.salt);
            try {
              revealTxHash = await writeRelayerContract({
                publicClient,
                walletClient,
                account,
                address: game,
                abi: hansomeGameAbi,
                functionName: "testnetRelayerRevealBatch",
                args: [tokenIds, BigInt(day), locationIds, salts],
                timing,
                timingLabel: "revealBatch",
                batchIndex,
                batchSize: chunk.length,
              });
              revealBatchesRun += 1;
              revealed += await countRevealedInTx(
                publicClient,
                game,
                revealTxHash,
                chunk.map((p) => p.tokenId),
              );
            } catch {
              timing.log("tx_error", {
                stage: "revealing",
                detail: "revealBatch_chunk_failed_fallback_singles",
                batchIndex,
                batchSize: chunk.length,
                ok: false,
              });
              for (const entry of chunk) {
                try {
                  revealTxHash = await writeRelayerContract({
                    publicClient,
                    walletClient,
                    account,
                    address: game,
                    abi: hansomeGameAbi,
                    functionName: "testnetRelayerRevealBatch",
                    args: [
                      [BigInt(entry.tokenId)],
                      BigInt(day),
                      [entry.locationId],
                      [entry.salt],
                    ],
                    timing,
                    timingLabel: "revealBatch_single",
                    batchIndex,
                    batchSize: 1,
                  });
                  revealBatchesRun += 1;
                  revealed += await countRevealedInTx(
                    publicClient,
                    game,
                    revealTxHash,
                    [entry.tokenId],
                  );
                } catch {
                  timing.log("skipped_call", {
                    stage: "revealing",
                    skipped: true,
                    detail: `reveal_token_failed:${entry.tokenId}`,
                  });
                }
              }
            }
          }
        }
        revealMs = msSince(tReveal);
      } else if (byToken.size > 0) {
        timing.log("skipped_call", {
          stage: "revealing",
          skipped: true,
          detail: `reveal_skipped_dayState=${dayState}_need=${REVEAL_OPEN}`,
          batchSize: byToken.size,
        });
      }
    }

    // ── 3) finalizeDay + creditBatch (bounded; same SettlementLib math) ─
    if (settle) {
      const tSettle = performance.now();
      let settledNow = Boolean(
        await publicClient.readContract({
          address: game,
          abi: hansomeGameAbi,
          functionName: "isSettled",
          args: [BigInt(day)],
        }),
      );
      if (settledNow) {
        alreadySettled = true;
        hasSeed = true;
        settleMs = msSince(tSettle);
      } else {
        const [finalStateRaw, seedReadyRaw, finalizedRaw] = await Promise.all([
          publicClient.readContract({
            address: game,
            abi: hansomeGameAbi,
            functionName: "dayState",
            args: [BigInt(day)],
          }),
          publicClient.readContract({
            address: randomness,
            abi: gameRandomnessAbi,
            functionName: "hasDaySeed",
            args: [BigInt(day)],
          }),
          publicClient.readContract({
            address: game,
            abi: hansomeGameAbi,
            functionName: "isFinalized",
            args: [BigInt(day)],
          }),
        ]);
        const finalState = Number(finalStateRaw);
        const seedReady = Boolean(seedReadyRaw);
        let finalized = Boolean(finalizedRaw);
        hasSeed = seedReady;

        const canFinalize =
          seedReady &&
          !finalized &&
          (finalState === REVEAL_OPEN || finalState === REVEAL_CLOSED);

        let finalizedThisRequest = false;
        if (canFinalize) {
          try {
            settleTxHash = await writeRelayerContract({
              publicClient,
              walletClient,
              account,
              address: game,
              abi: hansomeGameAbi,
              functionName: "finalizeDay",
              args: [BigInt(day)],
              timing,
              timingLabel: "finalizeDay",
            });
            finalized = true;
            dayFinalized = true;
            finalizedThisRequest = true;
            timing.markBattleReady({ detail: "finalizeDay_ok" });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (/AlreadyFinalized/i.test(msg)) {
              finalized = true;
              dayFinalized = true;
              timing.log("skipped_call", {
                stage: "finalizing",
                skipped: true,
                detail: "already_finalized",
              });
              timing.markBattleReady({ detail: "already_finalized" });
            } else if (isAlreadySettledError(msg)) {
              alreadySettled = true;
              dayFinalized = true;
              settledNow = true;
              timing.markBattleReady({ detail: "already_settled" });
              timing.markFullySettled({ detail: "already_settled" });
            } else {
              throw e;
            }
          }
        } else if (finalized) {
          dayFinalized = true;
          timing.markBattleReady({ detail: "was_finalized" });
        } else {
          timing.log("skipped_call", {
            stage: "finalizing",
            skipped: true,
            detail: `cannot_finalize_seedReady=${seedReady};finalState=${finalState}`,
          });
        }

        // After finalize, dayState is Claimable — credit in background polls.
        // Fresh finalize returns immediately so UI can show Battle Result.
        const canCredit =
          seedReady &&
          !settledNow &&
          (finalized ||
            finalState === REVEAL_OPEN ||
            finalState === REVEAL_CLOSED ||
            finalState === CLAIMABLE);

        const creditLoopBudget = finalizedThisRequest
          ? CREDIT_LOOPS_AFTER_FRESH_FINALIZE
          : MAX_CREDIT_LOOPS;

        if (
          canCredit &&
          (finalized || finalState === CLAIMABLE) &&
          creditLoopBudget > 0
        ) {
          if (!finalized) {
            finalized = Boolean(
              await publicClient.readContract({
                address: game,
                abi: hansomeGameAbi,
                functionName: "isFinalized",
                args: [BigInt(day)],
              }),
            );
          }
          for (let loop = 0; loop < creditLoopBudget && finalized; loop++) {
            settledNow = Boolean(
              await publicClient.readContract({
                address: game,
                abi: hansomeGameAbi,
                functionName: "isSettled",
                args: [BigInt(day)],
              }),
            );
            if (settledNow) {
              alreadySettled = true;
              break;
            }
            try {
              const creditHash = await writeRelayerContract({
                publicClient,
                walletClient,
                account,
                address: game,
                abi: hansomeGameAbi,
                functionName: "creditBatch",
                args: [BigInt(day), BigInt(MAX_CREDIT_BATCH)],
                timing,
                timingLabel: "creditBatch",
                batchIndex: loop,
                batchSize: MAX_CREDIT_BATCH,
              });
              settleTxHash = creditHash;
              creditBatchesRun += 1;
              timing.log("credit_batch_done", {
                stage: "finalizing",
                batchIndex: loop,
                batchSize: MAX_CREDIT_BATCH,
                cursor: loop,
                txHash: creditHash,
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              if (isAlreadySettledError(msg)) {
                alreadySettled = true;
                timing.log("skipped_call", {
                  stage: "finalizing",
                  skipped: true,
                  detail: "credit_already_settled",
                });
                break;
              }
              if (/NotFinalized/i.test(msg)) {
                timing.log("skipped_call", {
                  stage: "finalizing",
                  skipped: true,
                  detail: "credit_not_finalized",
                });
                break;
              }
              throw e;
            }
          }
          settledNow = Boolean(
            await publicClient.readContract({
              address: game,
              abi: hansomeGameAbi,
              functionName: "isSettled",
              args: [BigInt(day)],
            }),
          );
          if (settledNow) alreadySettled = true;
        } else if (finalizedThisRequest && !settledNow) {
          dayFinalized = true;
          timing.log("defer_credits", {
            stage: "crediting",
            skipped: true,
            detail: "return_battle_ready_credits_on_next_poll",
          });
        }
        settleMs = msSince(tSettle);
      }
    }

    return jsonOk();
  } catch (e) {
    const message = e instanceof Error ? e.message : "testnet-resolve failed";
    if (isIdempotentResolveError(message)) {
      alreadySettled = isAlreadySettledError(message) || alreadySettled;
      seedSkipped = isSeedAlreadySetError(message) || seedSkipped;
      return jsonOk();
    }
    const timings = buildTimings("error");
    timing.log("resolve_error", {
      stage: "error",
      ok: false,
      detail: message,
      ms: timings.totalMs,
    });
    lastResolveEndByDay.set(day, performance.now());
    // Log full message server-side only — never echo RPC/config internals to browsers in production.
    console.error("[testnet-resolve]", message, timings);
    const publicError =
      process.env.NODE_ENV === "production"
        ? "Battle settlement failed. Please try again shortly."
        : message;
    return NextResponse.json(
      {
        ok: false,
        enabled: true,
        day,
        revealed,
        revealTxHash,
        seedTxHash,
        settleTxHash,
        stage: "error" as const,
        timings,
        error: publicError,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(buildTestnetResolveStatus());
}
