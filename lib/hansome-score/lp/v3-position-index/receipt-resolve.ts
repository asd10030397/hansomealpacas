/**
 * Phase 10B — Mint receipt → NPM tokenId resolution (pure).
 *
 * Rules:
 * - Do NOT assume first Transfer is the target.
 * - Same receipt + NPM emitter (caller filters by address) + positions match.
 * - Prefer tokenIds that also appear in IncreaseLiquidity when available.
 * - Retain ALL matching tokenIds in one tx.
 */

import type {
  ResolveReceiptInput,
  ResolveReceiptResult,
} from "@/lib/hansome-score/lp/v3-position-index/types";

function norm(a: string): string {
  return a.trim().toLowerCase();
}

function poolKeyMatch(
  pos: { token0: string; token1: string; fee: number },
  pool: { token0: string; token1: string; fee: number },
): boolean {
  return (
    norm(pos.token0) === norm(pool.token0) &&
    norm(pos.token1) === norm(pool.token1) &&
    Number(pos.fee) === Number(pool.fee)
  );
}

/**
 * Resolve matching NPM tokenIds from an already-decoded Mint tx receipt payload.
 * Caller must only pass Transfer/IncreaseLiquidity logs emitted by the canonical NPM.
 */
export function resolveTokenIdsFromMintReceipt(
  input: ResolveReceiptInput,
): ResolveReceiptResult {
  const pool = {
    token0: input.poolToken0,
    token1: input.poolToken1,
    fee: input.poolFee,
  };

  const transferIds = new Set(input.transfers.map((t) => t.tokenId));
  const incIds = new Set(input.increaseLiquidity.map((i) => i.tokenId));

  // Candidates = union(Transfer tokenIds, IncreaseLiquidity tokenIds).
  // Do NOT assume first Transfer; filter via positions() pool key below.
  // When IncreaseLiquidity is present, matching still requires positions match;
  // IncreaseLiquidity alone does not prove pool key without positions().
  const allCandidates = new Set<string>([...transferIds, ...incIds]);

  const matching: string[] = [];
  const ignoredUnrelated: string[] = [];
  const ignoredWrongPool: string[] = [];
  const errors: string[] = [];

  for (const tokenId of [...allCandidates].sort((a, b) =>
    BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0,
  )) {
    const pos = input.positionsById[tokenId];
    if (pos === undefined) {
      errors.push(`positions missing for tokenId ${tokenId}`);
      continue;
    }
    if (pos === "error") {
      errors.push(`positions error for tokenId ${tokenId}`);
      continue;
    }
    if (pos === null) {
      // Nonexistent / unreadable — not a match
      ignoredUnrelated.push(tokenId);
      continue;
    }
    if (!poolKeyMatch(pos, pool)) {
      ignoredWrongPool.push(tokenId);
      continue;
    }
    matching.push(tokenId);
  }

  return {
    matchingTokenIds: matching,
    ignoredUnrelated,
    ignoredWrongPool,
    errors,
  };
}

/**
 * From Transfer logs for a single tokenId, derive last transfer tip (not current owner).
 * Current owner must still come from ownerOf.
 */
export function lastTransferTip(
  transfers: { tokenId: string; from: string; to: string; blockNumber: number; txHash: string }[],
  tokenId: string,
): { block: number; tx: string; to: string } | null {
  const rows = transfers
    .filter((t) => t.tokenId === tokenId)
    .sort((a, b) => a.blockNumber - b.blockNumber);
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1]!;
  return { block: last.blockNumber, tx: last.txHash, to: last.to };
}

export function isBurnTransfer(to: string): boolean {
  return norm(to) === "0x0000000000000000000000000000000000000000";
}

export function isMintTransfer(from: string): boolean {
  return norm(from) === "0x0000000000000000000000000000000000000000";
}
