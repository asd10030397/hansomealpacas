import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyForumSignature } from "@/lib/game/forum/auth";
import { toggleForumLike } from "@/lib/game/forum/store";
import type { ForumLikeTargetType } from "@/lib/game/forum/types";
import { isGenesisConfigured } from "@/lib/game/genesis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ToggleLikeBody = {
  targetType?: ForumLikeTargetType;
  targetId?: string;
  address?: string;
  signature?: `0x${string}`;
  nonce?: string;
};

export async function POST(req: Request) {
  if (!isGenesisConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Genesis NFT is not configured.", code: "GENESIS_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let body: ToggleLikeBody;
  try {
    body = (await req.json()) as ToggleLikeBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const address = (body.address ?? "").trim();
  const targetType = body.targetType;
  const targetId = (body.targetId ?? "").trim();

  if (!isAddress(address, { strict: false })) {
    return NextResponse.json(
      { ok: false, error: "Invalid wallet.", code: "INVALID_ADDRESS" },
      { status: 400 },
    );
  }
  if (targetType !== "thread" && targetType !== "reply") {
    return NextResponse.json(
      { ok: false, error: "Invalid target type.", code: "INVALID_TARGET_TYPE" },
      { status: 400 },
    );
  }
  if (!targetId) {
    return NextResponse.json(
      { ok: false, error: "Missing target id.", code: "INVALID_TARGET" },
      { status: 400 },
    );
  }

  const auth = await verifyForumSignature({
    address,
    nonce: body.nonce ?? "",
    action: "toggle-like",
    signature: (body.signature ?? "") as `0x${string}`,
    targetType,
    targetId,
  });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error, code: auth.code },
      { status: 401 },
    );
  }

  try {
    const result = await toggleForumLike({
      targetType,
      targetId,
      address,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "TARGET_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "Target not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Could not update like.", code: "STORE_ERROR" },
      { status: 500 },
    );
  }
}
