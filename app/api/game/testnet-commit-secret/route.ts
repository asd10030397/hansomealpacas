import { NextResponse } from "next/server";
import { isAddress, isHex, type Hex } from "viem";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import { GAME_CHAIN_ID } from "@/lib/game/hansomeGame";
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
      { ok: false, error: "Testnet-only." },
      { status: 403 },
    );
  }
  const flag = process.env.NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE?.trim();
  if (flag === "0" || flag === "false") {
    return NextResponse.json(
      { ok: false, error: "Gasless resolve disabled." },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const tokenId = Number(body.tokenId);
  const day = Number(body.day);
  const locationId = Number(body.locationId);
  const salt = (body.salt ?? "") as Hex;
  const commitHash = (body.commitHash ?? "") as Hex;
  const wallet = (body.wallet ?? "").trim();

  if (!Number.isInteger(tokenId) || tokenId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid tokenId." }, { status: 400 });
  }
  if (!Number.isInteger(day) || day < 0) {
    return NextResponse.json({ ok: false, error: "Invalid day." }, { status: 400 });
  }
  if (!Number.isInteger(locationId) || locationId < 0 || locationId > 4) {
    return NextResponse.json({ ok: false, error: "Invalid locationId." }, { status: 400 });
  }
  if (!isHex(salt) || salt.length !== 66) {
    return NextResponse.json({ ok: false, error: "Invalid salt." }, { status: 400 });
  }
  if (!isHex(commitHash) || commitHash.length !== 66) {
    return NextResponse.json({ ok: false, error: "Invalid commitHash." }, { status: 400 });
  }
  if (!isAddress(wallet)) {
    return NextResponse.json({ ok: false, error: "Invalid wallet." }, { status: 400 });
  }

  const record = upsertVaultCommitSecret({
    tokenId,
    day,
    locationId,
    salt,
    commitHash,
    wallet,
  });

  return NextResponse.json({
    ok: true,
    tokenId: record.tokenId,
    day: record.day,
  });
}
