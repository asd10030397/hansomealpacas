import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  isHex,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnetChain, ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import { hansomeGameAbi } from "@/lib/game/abis/hansomeGame";
import { gameRandomnessAbi } from "@/lib/game/abis/gameRandomness";
import {
  GAME_CHAIN_ID,
  HANSOME_GAME_ADDRESS,
} from "@/lib/game/hansomeGame";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RevealItem = {
  tokenId: number;
  locationId: number;
  salt: string;
};

type Body = {
  day?: number;
  reveals?: RevealItem[];
  fulfillSeed?: boolean;
  settle?: boolean;
};

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

  const reveals = Array.isArray(body.reveals) ? body.reveals : [];
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

  try {
    const dayState = await publicClient.readContract({
      address: game,
      abi: hansomeGameAbi,
      functionName: "dayState",
      args: [BigInt(day)],
    });

    // GameTypes.DayState: RevealOpen = 3, RevealClosed = 4 (see GameTypes.sol)
    const REVEAL_OPEN = 3;
    const REVEAL_CLOSED = 4;

    if (reveals.length > 0 && Number(dayState) === REVEAL_OPEN) {
      const tokenIds: bigint[] = [];
      const locationIds: number[] = [];
      const salts: Hex[] = [];

      for (const item of reveals) {
        const tokenId = Number(item.tokenId);
        const locationId = Number(item.locationId);
        const salt = item.salt as Hex;
        if (!Number.isInteger(tokenId) || tokenId < 0) continue;
        // LOC_HOME..LOC_RIVER = 0..4
        if (!Number.isInteger(locationId) || locationId < 0 || locationId > 4) {
          continue;
        }
        if (!isHex(salt) || salt.length !== 66) continue;

        tokenIds.push(BigInt(tokenId));
        locationIds.push(locationId);
        salts.push(salt);
      }

      if (tokenIds.length > 0) {
        try {
          const hash = await walletClient.writeContract({
            address: game,
            abi: hansomeGameAbi,
            functionName: "testnetRelayerRevealBatch",
            args: [tokenIds, BigInt(day), locationIds, salts],
          });
          await publicClient.waitForTransactionReceipt({ hash });
          revealTxHash = hash;
          revealed = tokenIds.length;
        } catch {
          // Fall back one-by-one so a single bad secret does not block the rest.
          for (let i = 0; i < tokenIds.length; i++) {
            try {
              const hash = await walletClient.writeContract({
                address: game,
                abi: hansomeGameAbi,
                functionName: "testnetRelayerRevealBatch",
                args: [
                  [tokenIds[i]!],
                  BigInt(day),
                  [locationIds[i]!],
                  [salts[i]!],
                ],
              });
              await publicClient.waitForTransactionReceipt({ hash });
              revealTxHash = hash;
              revealed += 1;
            } catch {
              // skip failed token
            }
          }
        }
      }
    }

    const randomness = (await publicClient.readContract({
      address: game,
      abi: hansomeGameAbi,
      functionName: "randomness",
    })) as Address;

    const hasSeed = await publicClient.readContract({
      address: randomness,
      abi: gameRandomnessAbi,
      functionName: "hasDaySeed",
      args: [BigInt(day)],
    });

    const stateAfter = await publicClient.readContract({
      address: game,
      abi: hansomeGameAbi,
      functionName: "dayState",
      args: [BigInt(day)],
    });

    if (fulfillSeed && !hasSeed && Number(stateAfter) >= REVEAL_CLOSED) {
      const seed = keccak256(
        toBytes(
          `hansome-testnet-seed:${day}:${Date.now()}:${account.address}`,
        ),
      );
      const hash = await walletClient.writeContract({
        address: randomness,
        abi: gameRandomnessAbi,
        functionName: "fulfillDaySeed",
        args: [BigInt(day), seed],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      seedTxHash = hash;
    }

    if (settle) {
      const settled = await publicClient.readContract({
        address: game,
        abi: hansomeGameAbi,
        functionName: "isSettled",
        args: [BigInt(day)],
      });
      const finalState = await publicClient.readContract({
        address: game,
        abi: hansomeGameAbi,
        functionName: "dayState",
        args: [BigInt(day)],
      });
      const seedReady = await publicClient.readContract({
        address: randomness,
        abi: gameRandomnessAbi,
        functionName: "hasDaySeed",
        args: [BigInt(day)],
      });

      if (!settled && Number(finalState) === REVEAL_CLOSED && seedReady) {
        const hash = await walletClient.writeContract({
          address: game,
          abi: hansomeGameAbi,
          functionName: "settleDay",
          args: [BigInt(day)],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        settleTxHash = hash;
      }
    }

    return NextResponse.json({
      ok: true,
      enabled: true,
      day,
      revealed,
      revealTxHash,
      seedTxHash,
      settleTxHash,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "testnet-resolve failed";
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
  });
}
