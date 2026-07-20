import { NextResponse } from "next/server";
import { isAddress, isHex, type Hex } from "viem";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import { computeCommitHash } from "@/lib/game/commitHash";
import { GAME_CHAIN_ID, HANSOME_GAME_ADDRESS } from "@/lib/game/hansomeGame";
import { isCommitVaultConfigured } from "@/lib/game/server/testnetCommitVaultConfig";
import { upsertVaultCommitSecret } from "@/lib/game/server/testnetCommitVault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  tokenId?: number;
  day?: number;
  locationId?: number;
  salt?: string;
  commitHash?: string;
  wallet?: string;
};

export async function POST(req: Request) {
  if (GAME_CHAIN_ID !== ROBINHOOD_TESTNET_CHAIN_ID) {
    return NextResponse.json(
      { ok: false, error: "Testnet-only.", code: "TESTNET_ONLY" },
      { status: 403 },
    );
  }
  const flag = process.env.NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE?.trim();
  if (flag === "0" || flag === "false") {
    return NextResponse.json(
      { ok: false, error: "Gasless resolve disabled.", code: "GASLESS_DISABLED" },
      { status: 403 },
    );
  }

  if (!isCommitVaultConfigured() || !HANSOME_GAME_ADDRESS) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Commit vault is not configured on this server. On-chain commit was not attempted — try again after vault storage is available.",
        code: "VAULT_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const tokenId = Number(body.tokenId);
  const day = Number(body.day);
  const locationId = Number(body.locationId);
  const salt = (body.salt ?? "") as Hex;
  const commitHash = (body.commitHash ?? "") as Hex;
  const wallet = (body.wallet ?? "").trim();

  if (!Number.isInteger(tokenId) || tokenId < 1) {
    return NextResponse.json(
      { ok: false, error: "Invalid tokenId.", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(day) || day < 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid day.", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(locationId) || locationId < 0 || locationId > 4) {
    return NextResponse.json(
      { ok: false, error: "Invalid locationId.", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }
  if (!isHex(salt) || salt.length !== 66) {
    return NextResponse.json(
      { ok: false, error: "Invalid salt.", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }
  if (!isHex(commitHash) || commitHash.length !== 66) {
    return NextResponse.json(
      { ok: false, error: "Invalid commitHash.", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }
  if (!isAddress(wallet, { strict: false })) {
    return NextResponse.json(
      { ok: false, error: "Invalid wallet.", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const expected = computeCommitHash(
    tokenId,
    day,
    locationId as 0 | 1 | 2 | 3 | 4,
    salt,
  );
  if (expected.toLowerCase() !== commitHash.toLowerCase()) {
    return NextResponse.json(
      {
        ok: false,
        error: "commitHash does not match salt and location.",
        code: "COMMITMENT_MISMATCH",
      },
      { status: 400 },
    );
  }

  const result = await upsertVaultCommitSecret({
    tokenId,
    day,
    locationId,
    salt,
    commitHash,
    wallet,
    chainId: GAME_CHAIN_ID,
    gameAddress: HANSOME_GAME_ADDRESS,
  });

  if (!result.ok) {
    const status =
      result.code === "VAULT_NOT_CONFIGURED"
        ? 503
        : result.code === "VAULT_CONFLICT"
          ? 409
          : 500;
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    tokenId: result.record.tokenId,
    day: result.record.day,
    idempotent: result.idempotent,
    verified: true,
  });
}
