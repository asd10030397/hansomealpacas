import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyForumSignature } from "@/lib/game/forum/auth";
import { verifyGenesisTokenOwnership } from "@/lib/game/forum/ownership";
import {
  checkForumCooldown,
  createForumThread,
  listForumThreads,
} from "@/lib/game/forum/store";
import {
  deriveForumTitle,
  isForumTextValid,
  sanitizeForumText,
} from "@/lib/game/forum/sanitize";
import {
  DEFAULT_FORUM_BOARD_SLUG,
  FORUM_LIMITS,
  isForumBoardSlug,
  type ForumBoardSlug,
} from "@/lib/game/forum/types";
import { isGenesisConfigured } from "@/lib/game/genesis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ ok: false, error, code }, { status });
}

function parseForumBoardParam(value: string | null): ForumBoardSlug | null {
  const trimmed = (value ?? DEFAULT_FORUM_BOARD_SLUG).trim();
  return isForumBoardSlug(trimmed) ? trimmed : null;
}

function genesisGate() {
  if (!isGenesisConfigured()) {
    return jsonError(
      "Genesis NFT is not configured on this deployment.",
      "GENESIS_NOT_CONFIGURED",
      503,
    );
  }
  return null;
}

export async function GET(req: Request) {
  const gate = genesisGate();
  if (gate) return gate;

  const url = new URL(req.url);
  const board = parseForumBoardParam(url.searchParams.get("board"));
  if (!board) {
    return jsonError("Unknown board.", "INVALID_BOARD", 400);
  }

  const viewerAddress = (url.searchParams.get("address") ?? "").trim();
  const threads = await listForumThreads(
    board,
    isAddress(viewerAddress, { strict: false }) ? viewerAddress : undefined,
  );
  return NextResponse.json({ ok: true, board, threads });
}

type CreateThreadBody = {
  boardSlug?: string;
  title?: string;
  body?: string;
  tokenId?: number;
  address?: string;
  signature?: `0x${string}`;
  nonce?: string;
};

export async function POST(req: Request) {
  const gate = genesisGate();
  if (gate) return gate;

  let body: CreateThreadBody;
  try {
    body = (await req.json()) as CreateThreadBody;
  } catch {
    return jsonError("Invalid JSON.", "INVALID_JSON", 400);
  }

  const boardSlug = parseForumBoardParam(body.boardSlug ?? null);
  if (!boardSlug) {
    return jsonError("Unknown board.", "INVALID_BOARD", 400);
  }

  const address = (body.address ?? "").trim();
  const tokenId = Number(body.tokenId);
  const textBody = sanitizeForumText(body.body ?? "", FORUM_LIMITS.maxBody);
  const title = body.title?.trim()
    ? sanitizeForumText(body.title, FORUM_LIMITS.maxTitle)
    : deriveForumTitle(textBody, FORUM_LIMITS.maxTitle);

  if (!isAddress(address, { strict: false })) {
    return jsonError("Invalid wallet.", "INVALID_ADDRESS", 400);
  }
  if (!Number.isInteger(tokenId) || tokenId < 1) {
    return jsonError("Invalid tokenId.", "INVALID_TOKEN", 400);
  }
  if (!isForumTextValid(textBody) || !isForumTextValid(title)) {
    return jsonError("Body is required (plain text only).", "INVALID_CONTENT", 400);
  }

  const auth = await verifyForumSignature({
    address,
    nonce: body.nonce ?? "",
    action: "create-thread",
    signature: (body.signature ?? "") as `0x${string}`,
  });
  if (!auth.ok) {
    return jsonError(auth.error, auth.code, 401);
  }

  const owns = await verifyGenesisTokenOwnership(address, tokenId);
  if (!owns) {
    return jsonError("You must own the selected Genesis NFT.", "NOT_OWNER", 403);
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
    const thread = await createForumThread({
      boardSlug,
      title,
      body: textBody,
      authorAddress: address,
      tokenId,
    });
    return NextResponse.json({ ok: true, thread });
  } catch {
    return jsonError("Could not create thread.", "STORE_ERROR", 500);
  }
}
