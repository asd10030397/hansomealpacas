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
import { writeRelayerContract } from "@/lib/game/server/testnetRelayerWrite";
import { isDefinitelyAlreadyRevealed } from "@/lib/game/homeRevealGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function relayerPrivateKey(): Hex | null {
  const raw =
    process.env.GAME_TESTNET_RELAYER_PRIVATE_KEY?.trim() ||
    process.env.DEPLOYER_PRIVATE_KEY?.trim() ||
    process.env.TREASURY_PRIVATE_KEY?.trim() ||
    "";
  if (!raw) return null;
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  return isHex(key) && key.length === 66 ? key : null;
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

  const pk = relayerPrivateKey();
  if (!pk) {
    return NextResponse.json(
      {
        ok: false,
        enabled: false,
        error:
          "Missing GAME_TESTNET_RELAYER_PRIVATE_KEY (server-only; game owner / randomness provider).",
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
  let seedSkipped = false;

  try {
    const settledEarly = await publicClient.readContract({
      address: game,
      abi: hansomeGameAbi,
      functionName: "isSettled",
      args: [BigInt(day)],
    });
    if (settledEarly) {
      return NextResponse.json({
        ok: true,
        enabled: true,
        day,
        alreadySettled: true,
        seedSkipped: true,
        revealed: 0,
        revealTxHash: null,
        seedTxHash: null,
        settleTxHash: null,
        vaultCount: vaultSecretCountForDay(day),
      });
    }

    const randomness = (await publicClient.readContract({
      address: game,
      abi: hansomeGameAbi,
      functionName: "randomness",
    })) as Address;

    let dayState = Number(
      await publicClient.readContract({
        address: game,
        abi: hansomeGameAbi,
        functionName: "dayState",
        args: [BigInt(day)],
      }),
    );

    // ── 1) Seed: check → fulfill only if needed (idempotent) ──────────
    let hasSeed = Boolean(
      await publicClient.readContract({
        address: randomness,
        abi: gameRandomnessAbi,
        functionName: "hasDaySeed",
        args: [BigInt(day)],
      }),
    );

    if (fulfillSeed && !hasSeed && dayState >= REVEAL_OPEN) {
      // Re-check immediately before send (concurrent resolve race).
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
          });
          hasSeed = true;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!isSeedAlreadySetError(msg)) throw e;
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
        }
      }
    } else if (hasSeed) {
      seedSkipped = true;
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

    dayState = Number(
      await publicClient.readContract({
        address: game,
        abi: hansomeGameAbi,
        functionName: "dayState",
        args: [BigInt(day)],
      }),
    );

    if (byToken.size > 0 && dayState === REVEAL_OPEN) {
      const entries = [...byToken.values()];
      // Skip tokens already revealed on-chain (idempotent / concurrent resolve).
      const pending: typeof entries = [];
      for (const entry of entries) {
        const loc = Number(
          await publicClient.readContract({
            address: game,
            abi: hansomeGameAbi,
            functionName: "locationOf",
            args: [BigInt(entry.tokenId), BigInt(day)],
          }),
        );
        // locationOf defaults to 0 — same as Home. Never skip Home on that alone.
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

      if (pending.length > 0) {
        const tokenIds = pending.map((r) => BigInt(r.tokenId));
        const locationIds = pending.map((r) => r.locationId);
        const salts = pending.map((r) => r.salt);

        try {
          revealTxHash = await writeRelayerContract({
            publicClient,
            walletClient,
            account,
            address: game,
            abi: hansomeGameAbi,
            functionName: "testnetRelayerRevealBatch",
            args: [tokenIds, BigInt(day), locationIds, salts],
          });
          revealed += await countRevealedInTx(
            publicClient,
            game,
            revealTxHash,
            pending.map((p) => p.tokenId),
          );
        } catch {
          for (const entry of pending) {
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
              });
              revealed += await countRevealedInTx(
                publicClient,
                game,
                revealTxHash,
                [entry.tokenId],
              );
            } catch {
              // skip failed token
            }
          }
        }
      }
    }

    // ── 3) Settle when eligible ───────────────────────────────────────
    if (settle) {
      const settled = await publicClient.readContract({
        address: game,
        abi: hansomeGameAbi,
        functionName: "isSettled",
        args: [BigInt(day)],
      });
      if (settled) {
        alreadySettled = true;
      } else {
        const finalState = Number(
          await publicClient.readContract({
            address: game,
            abi: hansomeGameAbi,
            functionName: "dayState",
            args: [BigInt(day)],
          }),
        );
        const seedReady = Boolean(
          await publicClient.readContract({
            address: randomness,
            abi: gameRandomnessAbi,
            functionName: "hasDaySeed",
            args: [BigInt(day)],
          }),
        );

        const canSettle =
          finalState === REVEAL_OPEN || finalState === REVEAL_CLOSED;
        if (canSettle && seedReady) {
          try {
            settleTxHash = await writeRelayerContract({
              publicClient,
              walletClient,
              account,
              address: game,
              abi: hansomeGameAbi,
              functionName: "settleDay",
              args: [BigInt(day)],
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (isAlreadySettledError(msg)) {
              alreadySettled = true;
            } else {
              throw e;
            }
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      enabled: true,
      day,
      alreadySettled,
      seedSkipped,
      revealed,
      revealTxHash,
      seedTxHash,
      settleTxHash,
      vaultCount: vaultSecretCountForDay(day),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "testnet-resolve failed";
    if (isIdempotentResolveError(message)) {
      return NextResponse.json({
        ok: true,
        enabled: true,
        day,
        alreadySettled: isAlreadySettledError(message) || alreadySettled,
        seedSkipped: isSeedAlreadySetError(message) || seedSkipped,
        revealed,
        revealTxHash,
        seedTxHash,
        settleTxHash,
        vaultCount: vaultSecretCountForDay(day),
      });
    }
    console.error("[testnet-resolve]", message);
    return NextResponse.json(
      {
        ok: false,
        enabled: true,
        day,
        revealed,
        revealTxHash,
        seedTxHash,
        settleTxHash,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  const enabled =
    GAME_CHAIN_ID === ROBINHOOD_TESTNET_CHAIN_ID &&
    process.env.NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE?.trim() !== "0" &&
    process.env.NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE?.trim() !== "false" &&
    Boolean(relayerPrivateKey()) &&
    Boolean(HANSOME_GAME_ADDRESS);

  return NextResponse.json({
    ok: true,
    enabled,
    chainId: GAME_CHAIN_ID,
    game: HANSOME_GAME_ADDRESS,
    gaslessFlag: process.env.NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE ?? "(default on)",
  });
}
