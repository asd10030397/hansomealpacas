import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { buildForumAuthMessage } from "@/lib/game/forum/auth";
import { issueForumNonce } from "@/lib/game/forum/store";
import { GENESIS_CHAIN_ID, isGenesisConfigured } from "@/lib/game/genesis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isGenesisConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Genesis NFT is not configured.", code: "GENESIS_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  const action = url.searchParams.get("action") ?? "create-thread";
  const targetType = url.searchParams.get("targetType") ?? "";
  const targetId = (url.searchParams.get("targetId") ?? "").trim();

  if (!isAddress(address, { strict: false })) {
    return NextResponse.json(
      { ok: false, error: "Invalid wallet.", code: "INVALID_ADDRESS" },
      { status: 400 },
    );
  }
  if (
    action !== "create-thread" &&
    action !== "create-reply" &&
    action !== "toggle-like" &&
    action !== "delete-thread" &&
    action !== "delete-reply"
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid action.", code: "INVALID_ACTION" },
      { status: 400 },
    );
  }
  if (
    action === "toggle-like" ||
    action === "delete-thread" ||
    action === "delete-reply"
  ) {
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
  }

  const { nonce, expiresAt } = await issueForumNonce(address);
  const message = buildForumAuthMessage({
    address,
    nonce,
    action,
    targetType:
      action === "toggle-like" ||
      action === "delete-thread" ||
      action === "delete-reply"
        ? (targetType as "thread" | "reply")
        : undefined,
    targetId:
      action === "toggle-like" ||
      action === "delete-thread" ||
      action === "delete-reply"
        ? targetId
        : undefined,
  });

  return NextResponse.json({
    ok: true,
    nonce,
    expiresAt,
    message,
    chainId: GENESIS_CHAIN_ID,
  });
}
