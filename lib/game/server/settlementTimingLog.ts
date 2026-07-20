/**
 * Temporary structured settlement latency logs (server-only).
 * Never log private keys, mnemonics, tokens, or secret env values.
 *
 * Enable verbose file of events via SETTLEMENT_TIMING_LOG=1 (default on for
 * testnet-resolve POST). Safe to leave — logs are structured JSON lines.
 */

export type SettlementTimingEvent = {
  ts: string;
  tMs: number;
  requestId: string;
  day: number;
  event: string;
  stage?: string;
  ok?: boolean;
  ms?: number;
  txHash?: string;
  attempt?: number;
  batchIndex?: number;
  batchSize?: number;
  cursor?: string | number;
  skipped?: boolean;
  retries?: number;
  errorCode?: string;
  detail?: string;
  rpcMs?: number;
  lockWaitMs?: number;
  submitMs?: number;
  receiptMs?: number;
  battleReadyMs?: number;
  fullySettledMs?: number;
  pollGapMs?: number;
  [key: string]: string | number | boolean | undefined | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeDetail(raw: string): string {
  // Strip hex keys / long secrets if they ever appear in error text.
  return raw
    .replace(/0x[a-fA-F0-9]{64}/g, "0x[redacted]")
    .replace(/(PRIVATE_KEY|PINATA_JWT|BOT_TOKEN|Bearer)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 240);
}

export class SettlementTimingTrace {
  readonly requestId: string;
  readonly day: number;
  readonly t0: number;
  private battleReadyAt: number | null = null;
  private fullySettledAt: number | null = null;
  private events: SettlementTimingEvent[] = [];

  constructor(day: number, requestId?: string) {
    this.day = day;
    this.requestId =
      requestId ??
      `r${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.t0 = performance.now();
  }

  elapsed(): number {
    return Math.round(performance.now() - this.t0);
  }

  log(
    event: string,
    extra: Omit<
      SettlementTimingEvent,
      "ts" | "tMs" | "requestId" | "day" | "event"
    > = {},
  ): void {
    const row: SettlementTimingEvent = {
      ts: nowIso(),
      tMs: this.elapsed(),
      requestId: this.requestId,
      day: this.day,
      event,
      ...extra,
    };
    if (typeof row.detail === "string") {
      row.detail = sanitizeDetail(row.detail);
    }
    this.events.push(row);
    // Single-line JSON for easy grepping in Vercel / local server logs.
    console.info("[settlement-timing]", JSON.stringify(row));
  }

  markBattleReady(extra: Record<string, string | number | boolean> = {}): void {
    if (this.battleReadyAt != null) return;
    this.battleReadyAt = performance.now();
    this.log("battle_ready", {
      battleReadyMs: Math.round(this.battleReadyAt - this.t0),
      ...extra,
    });
  }

  markFullySettled(extra: Record<string, string | number | boolean> = {}): void {
    if (this.fullySettledAt != null) return;
    this.fullySettledAt = performance.now();
    this.log("fully_settled", {
      fullySettledMs: Math.round(this.fullySettledAt - this.t0),
      battleReadyMs:
        this.battleReadyAt != null
          ? Math.round(this.battleReadyAt - this.t0)
          : undefined,
      ...extra,
    });
  }

  summary(stage: string): void {
    this.log("resolve_complete", {
      stage,
      battleReadyMs:
        this.battleReadyAt != null
          ? Math.round(this.battleReadyAt - this.t0)
          : undefined,
      fullySettledMs:
        this.fullySettledAt != null
          ? Math.round(this.fullySettledAt - this.t0)
          : undefined,
      ms: this.elapsed(),
    });
  }

  getEvents(): readonly SettlementTimingEvent[] {
    return this.events;
  }
}
