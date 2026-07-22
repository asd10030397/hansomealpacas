import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyForumSignature } from "@/lib/game/forum/auth";
import { verifyGenesisTokenOwnership } from "@/lib/game/forum/ownership";
import { checkForumCooldown, createForumReply } from "@/lib/game/forum/store";
import { isForumTextValid, sanitizeForumText } from "@/lib/game/forum/sanitize";
import { FORUM_LIMITS } from "@/lib/game/forum/types";
import { isGenesisConfigured } from "@/lib/game/genesis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ threadId: string }> };

type CreateReplyBody = {
  body?: string;
  tokenId?: number;
  address?: string;
  signature?: `0x${string}`;
  nonce?: string;
};

export async function POST(req: Request, { params }: Params) {
  if (!isGenesisConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Genesis NFT is not configured.", code: "GENESIS_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const { threadId } = await params;
  if (!threadId?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Missing thread id.", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  let body: CreateReplyBody;
  try {
    body = (await req.json()) as CreateReplyBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const address = (body.address ?? "").trim();
  const tokenId = Number(body.tokenId);
  const textBody = sanitizeForumText(body.body ?? "", FORUM_LIMITS.maxBody);

  if (!isAddress(address, { strict: false })) {
    return NextResponse.json(
      { ok: false, error: "Invalid wallet.", code: "INVALID_ADDRESS" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(tokenId) || tokenId < 1) {
    return NextResponse.json(
      { ok: false, error: "Invalid tokenId.", code: "INVALID_TOKEN" },
      { status: 400 },
    );
  }
  if (!isForumTextValid(textBody)) {
    return NextResponse.json(
      { ok: false, error: "Reply body is required (plain text only).", code: "INVALID_CONTENT" },
      { status: 400 },
    );
  }

  const auth = await verifyForumSignature({
    address,
    nonce: body.nonce ?? "",
    action: "create-reply",
    signature: (body.signature ?? "") as `0x${string}`,
  });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error, code: auth.code },
      { status: 401 },
    );
  }

  const owns = await verifyGenesisTokenOwnership(address, tokenId);
  if (!owns) {
    return NextResponse.json(
      { ok: false, error: "You must own the selected Genesis NFT.", code: "NOT_OWNER" },
      { status: 403 },
    );
  }

  const cooldown = await checkForumCooldown(address);
  if (!cooldown.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please wait before posting again.",
        code: "RATE_LIMITED",
        retryAfterMs: cooldown.retryAfterMs,
      },
      { status: 429 },
    );
  }

  try {
    const reply = await createForumReply({
      threadId,
      body: textBody,
      authorAddress: address,
      tokenId,
    });
    return NextResponse.json({ ok: true, reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "THREAD_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "Thread not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Could not create reply.", code: "STORE_ERROR" },
      { status: 500 },
    );
  }
}
