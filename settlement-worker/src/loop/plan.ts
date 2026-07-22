/**
 * Settlement planner — mirrors lib/game/walletBatchedSettlement.ts
 * (copied into worker to avoid importing Next.js app paths).
 */

export const MAX_CREDIT_BATCH = 50;

export type CreditProgress = {
  cursor: number;
  total: number;
  finalized: boolean;
  settled: boolean;
};

export type SettlementPlan =
  | { action: "noop"; reason: "already_settled" | "not_ready" | "waiting_seed" }
  | { action: "seed" }
  | { action: "finalize" }
  | { action: "credit"; limit: number; cursor: number; total: number }
  | { action: "done"; cursor: number; total: number };

export function planSettlementStep(input: {
  hasDaySeed: boolean;
  seedPhaseOk: boolean;
  settlePhaseOk: boolean;
  progress: CreditProgress | null;
  batchLimit?: number;
}): SettlementPlan {
  const limit = Math.min(
    MAX_CREDIT_BATCH,
    Math.max(1, input.batchLimit ?? MAX_CREDIT_BATCH),
  );
  const p = input.progress;

  if (p?.settled || (p?.finalized && p.total > 0 && p.cursor >= p.total)) {
    return {
      action: "done",
      cursor: p?.cursor ?? 0,
      total: p?.total ?? 0,
    };
  }
  if (p?.settled) {
    return { action: "noop", reason: "already_settled" };
  }

  if (!input.hasDaySeed) {
    if (input.seedPhaseOk) return { action: "seed" };
    return { action: "noop", reason: "waiting_seed" };
  }

  if (!p || !p.finalized) {
    if (input.settlePhaseOk) return { action: "finalize" };
    return { action: "noop", reason: "not_ready" };
  }

  if (p.total === 0) {
    return { action: "done", cursor: 0, total: 0 };
  }
  if (p.cursor >= p.total) {
    return { action: "done", cursor: p.cursor, total: p.total };
  }
  return {
    action: "credit",
    limit,
    cursor: p.cursor,
    total: p.total,
  };
}

export function isBenignRevert(message: string | null | undefined): boolean {
  if (!message) return false;
  return /AlreadyFinalized|AlreadySettled|SeedAlreadySet/i.test(message);
}
