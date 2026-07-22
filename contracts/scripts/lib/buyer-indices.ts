/**
 * Resolve which BUYER_N_* wallets an ops script should use.
 *
 * Env (any one):
 *   BUYER_INDICES=6,7,8,9,10
 *   BUYER_START=6 + BUYER_COUNT=5
 * Default: 1..5 (legacy wave)
 */
import { parseEther } from "ethers";

export function resolveBuyerIndices(): number[] {
  const indicesRaw = process.env.BUYER_INDICES?.trim();
  if (indicesRaw) {
    const indices = indicesRaw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (indices.length === 0) {
      throw new Error("BUYER_INDICES is set but empty / invalid");
    }
    return indices;
  }

  const start = process.env.BUYER_START ? Number(process.env.BUYER_START) : 1;
  const count = process.env.BUYER_COUNT ? Number(process.env.BUYER_COUNT) : 5;
  if (!Number.isInteger(start) || start < 1) {
    throw new Error(`BUYER_START must be a positive integer, got ${process.env.BUYER_START}`);
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`BUYER_COUNT must be a positive integer, got ${process.env.BUYER_COUNT}`);
  }
  return Array.from({ length: count }, (_, i) => start + i);
}

export function parseEthAmountList(raw: string, expectedLen: number, label: string): bigint[] {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length !== expectedLen) {
    throw new Error(`${label} must have exactly ${expectedLen} amounts, got ${parts.length}`);
  }
  return parts.map((p) => parseEther(p));
}
