import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyForumSignature } from "@/lib/game/forum/auth";
import { getForumThread, hideForumThread } from "@/lib/game/forum/store";
import { isGenesisConfigured } from "@/lib/game/genesis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ threadId: string }> };

type DeleteThreadBody = {
  address?: string;
  signature?: `0x${string}`;
  nonce?: string;
};

export async function GET(req: Request, { params }: Params) {
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

  const url = new URL(req.url);
  const viewerAddress = (url.searchParams.get("address") ?? "").trim();
  const data = await getForumThread(
    threadId,
    isAddress(viewerAddress, { strict: false }) ? viewerAddress : undefined,
  );
  if (!data) {
    return NextResponse.json(
      { ok: false, error: "Thread not found.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, ...data });
}

export async function DELETE(req: Request, { params }: Params) {
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

  let body: DeleteThreadBody;
  try {
    body = (await req.json()) as DeleteThreadBody;
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
    action: "delete-thread",
    signature: (body.signature ?? "") as `0x${string}`,
    targetType: "thread",
    targetId: threadId,
  });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error, code: auth.code },
      { status: 401 },
    );
  }

  try {
    await hideForumThread({ threadId, authorAddress: address });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "THREAD_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "Thread not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    if (msg === "NOT_AUTHOR") {
      return NextResponse.json(
        { ok: false, error: "Only the author can delete this thread.", code: "NOT_AUTHOR" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Could not delete thread.", code: "STORE_ERROR" },
      { status: 500 },
    );
  }
}
