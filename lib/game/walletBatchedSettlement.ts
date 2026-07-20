/**
 * Wallet-path batched settlement (finalizeDay + creditBatch).
 * Mirrors gasless relayer architecture — settleDay is not the primary path.
 */

export const DEFAULT_WALLET_CREDIT_BATCH_LIMIT = 25;

export type CreditProgressView = {
  cursor: bigint | number;
  total: bigint | number;
  finalized: boolean;
  settled: boolean;
};

export type WalletSettlementPlan =
  | { action: "noop"; reason: "already_settled" | "not_ready" }
  | { action: "finalize" }
  | { action: "credit"; limit: number; cursor: number; total: number }
  | { action: "done"; cursor: number; total: number };

export function parseCreditProgress(
  raw: readonly unknown[] | CreditProgressView | null | undefined,
): CreditProgressView | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    if (raw.length < 4) return null;
    return {
      cursor: raw[0] as bigint | number,
      total: raw[1] as bigint | number,
      finalized: Boolean(raw[2]),
      settled: Boolean(raw[3]),
    };
  }
  if (
    typeof raw === "object" &&
    "cursor" in raw &&
    "total" in raw &&
    "finalized" in raw &&
    "settled" in raw
  ) {
    return raw;
  }
  return null;
}

/**
 * Decide the next wallet settlement step from on-chain creditProgress.
 * Resumable: never restarts credit cursor; skips finalize when already done.
 */
export function planWalletSettlementStep(input: {
  progress: CreditProgressView | null;
  /** Day is eligible for settle (reveal closed / seed ready UI). */
  settleEligible: boolean;
  batchLimit?: number;
}): WalletSettlementPlan {
  const limit = Math.max(1, input.batchLimit ?? DEFAULT_WALLET_CREDIT_BATCH_LIMIT);
  const p = input.progress;
  if (!p) {
    return input.settleEligible
      ? { action: "finalize" }
      : { action: "noop", reason: "not_ready" };
  }

  const cursor = Number(p.cursor);
  const total = Number(p.total);
  if (p.settled || (p.finalized && total > 0 && cursor >= total)) {
    return { action: "done", cursor, total };
  }
  if (p.settled) {
    return { action: "noop", reason: "already_settled" };
  }
  if (!p.finalized) {
    return input.settleEligible
      ? { action: "finalize" }
      : { action: "noop", reason: "not_ready" };
  }
  // Finalized with zero participants → already settled by contract, but be safe.
  if (total === 0) {
    return { action: "done", cursor: 0, total: 0 };
  }
  if (cursor >= total) {
    return { action: "done", cursor, total };
  }
  return { action: "credit", limit, cursor, total };
}

/** True when another actor may have advanced the day (benign Already* errors). */
export function isBenignSettlementRevert(message: string | null | undefined): boolean {
  if (!message) return false;
  return /AlreadyFinalized|AlreadySettled|NotFinalized/i.test(message);
}
