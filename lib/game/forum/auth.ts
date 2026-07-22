import "server-only";

import { getAddress, isAddress, verifyMessage } from "viem";
import { GENESIS_CHAIN_ID } from "@/lib/game/genesis";
import { consumeForumNonce } from "@/lib/game/forum/store";
import type { ForumAuthAction, ForumLikeTargetType } from "@/lib/game/forum/types";

export function buildForumAuthMessage(input: {
  address: string;
  nonce: string;
  action: ForumAuthAction;
  targetType?: ForumLikeTargetType;
  targetId?: string;
}): string {
  const address = getAddress(input.address);
  const lines = [
    "HANSOME Forum Authentication",
    "",
    `Action: ${input.action}`,
    `Address: ${address}`,
    `Nonce: ${input.nonce}`,
    `Chain ID: ${GENESIS_CHAIN_ID}`,
  ];
  if (
    input.action === "toggle-like" ||
    input.action === "delete-thread" ||
    input.action === "delete-reply"
  ) {
    lines.push(`Target Type: ${input.targetType ?? ""}`);
    lines.push(`Target ID: ${input.targetId ?? ""}`);
  }
  return lines.join("\n");
}

export async function verifyForumSignature(input: {
  address: string;
  nonce: string;
  action: ForumAuthAction;
  signature: `0x${string}`;
  targetType?: ForumLikeTargetType;
  targetId?: string;
}): Promise<{ ok: true } | { ok: false; code: string; error: string }> {
  if (!isAddress(input.address, { strict: false })) {
    return { ok: false, code: "INVALID_ADDRESS", error: "Invalid wallet address." };
  }
  if (!input.nonce?.trim()) {
    return { ok: false, code: "INVALID_NONCE", error: "Missing nonce." };
  }
  if (!input.signature?.startsWith("0x")) {
    return { ok: false, code: "INVALID_SIGNATURE", error: "Invalid signature." };
  }

  const address = getAddress(input.address);
  const message = buildForumAuthMessage({
    address,
    nonce: input.nonce.trim(),
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
  });

  let valid = false;
  try {
    valid = await verifyMessage({
      address,
      message,
      signature: input.signature,
    });
  } catch {
    valid = false;
  }
  if (!valid) {
    return { ok: false, code: "SIGNATURE_MISMATCH", error: "Signature verification failed." };
  }

  const nonceOk = await consumeForumNonce(address, input.nonce.trim());
  if (!nonceOk) {
    return { ok: false, code: "NONCE_EXPIRED", error: "Nonce expired or already used." };
  }

  return { ok: true };
}
