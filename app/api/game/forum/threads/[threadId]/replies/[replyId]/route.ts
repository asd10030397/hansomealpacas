import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyForumSignature } from "@/lib/game/forum/auth";
import { hideForumReply } from "@/lib/game/forum/store";
import { isGenesisConfigured } from "@/lib/game/genesis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ threadId: string; replyId: string }> };

type DeleteReplyBody = {
  address?: string;
  signature?: `0x${string}`;
  nonce?: string;
};

export async function DELETE(req: Request, { params }: Params) {
  if (!isGenesisConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Genesis NFT is not configured.", code: "GENESIS_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const { threadId, replyId } = await params;
  if (!threadId?.trim() || !replyId?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Missing thread or reply id.", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  let body: DeleteReplyBody;
  try {
    body = (await req.json()) as DeleteReplyBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const address = (body.address ?? "").trim();
  if (!isAddress(address, { strict: false })) {
    return NextResponse.json(
      { ok: false, error: "Invalid wallet.", code: "INVALID_ADDRESS" },
      { status: 400 },
    );
  }

  const auth = await verifyForumSignature({
    address,
    nonce: body.nonce ?? "",
    action: "delete-reply",
    signature: (body.signature ?? "") as `0x${string}`,
    targetType: "reply",
    targetId: replyId,
  });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error, code: auth.code },
      { status: 401 },
    );
  }

  try {
    await hideForumReply({ replyId, threadId, authorAddress: address });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "REPLY_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "Reply not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    if (msg === "NOT_AUTHOR") {
      return NextResponse.json(
        { ok: false, error: "Only the author can delete this reply.", code: "NOT_AUTHOR" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Could not delete reply.", code: "STORE_ERROR" },
      { status: 500 },
    );
  }
}
