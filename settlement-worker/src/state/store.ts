import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

export type DayRecord = {
  day: number;
  seededAt?: string;
  finalizedAt?: string;
  settledAt?: string;
  lastCreditCursor?: number;
  lastTxHash?: string;
  lastError?: string;
};

export type WorkerStateSnapshot = {
  updatedAt: string;
  days: Record<string, DayRecord>;
  /** In-flight tx idempotency: actionKey → txHash */
  inflight: Record<string, string>;
  /** Completed action keys for idempotency */
  done: Record<string, string>;
};

export interface StateStore {
  load(): Promise<WorkerStateSnapshot>;
  save(snap: WorkerStateSnapshot): Promise<void>;
  /** Try acquire short lock; returns true if acquired. */
  tryLock(lockKey: string, ttlMs: number): Promise<boolean>;
  releaseLock(lockKey: string): Promise<void>;
  close(): Promise<void>;
}

function emptySnap(): WorkerStateSnapshot {
  return {
    updatedAt: new Date().toISOString(),
    days: {},
    inflight: {},
    done: {},
  };
}

/** File-backed store — restart-safe without Redis. */
export class FileStateStore implements StateStore {
  private file: string;
  private locks = new Map<string, number>();

  constructor(dir: string, filename = "state.json") {
    mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, filename);
  }

  async load(): Promise<WorkerStateSnapshot> {
    if (!existsSync(this.file)) return emptySnap();
    try {
      const raw = readFileSync(this.file, "utf8");
      const parsed = JSON.parse(raw) as WorkerStateSnapshot;
      return {
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        days: parsed.days || {},
        inflight: parsed.inflight || {},
        done: parsed.done || {},
      };
    } catch (e) {
      log.warn("state_load_failed", { error: String(e) });
      return emptySnap();
    }
  }

  async save(snap: WorkerStateSnapshot): Promise<void> {
    const next = { ...snap, updatedAt: new Date().toISOString() };
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(next, null, 2));
    writeFileSync(this.file, JSON.stringify(next, null, 2));
  }

  async tryLock(lockKey: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const until = this.locks.get(lockKey) ?? 0;
    if (until > now) return false;
    this.locks.set(lockKey, now + ttlMs);
    return true;
  }

  async releaseLock(lockKey: string): Promise<void> {
    this.locks.delete(lockKey);
  }

  async close(): Promise<void> {
    /* no-op */
  }
}

/**
 * Redis REST (Upstash-compatible) store via fetch.
 * Keys: {namespace}:state , {namespace}:lock:{key}
 */
export class RedisRestStateStore implements StateStore {
  constructor(
    private baseUrl: string,
    private token: string,
    private namespace: string,
  ) {}

  private async cmd<T>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args.map(String)),
    });
    if (!res.ok) {
      throw new Error(`Redis REST ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as { result: T };
    return body.result;
  }

  private stateKey() {
    return `${this.namespace}:state`;
  }

  async load(): Promise<WorkerStateSnapshot> {
    const raw = await this.cmd<string | null>("GET", this.stateKey());
    if (!raw) return emptySnap();
    try {
      return JSON.parse(raw) as WorkerStateSnapshot;
    } catch {
      return emptySnap();
    }
  }

  async save(snap: WorkerStateSnapshot): Promise<void> {
    const next = { ...snap, updatedAt: new Date().toISOString() };
    await this.cmd("SET", this.stateKey(), JSON.stringify(next));
  }

  async tryLock(lockKey: string, ttlMs: number): Promise<boolean> {
    const key = `${this.namespace}:lock:${lockKey}`;
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
    // SET key nx ex — Upstash REST supports SET with options as extra args
    const result = await this.cmd<string | null>(
      "SET",
      key,
      "1",
      "NX",
      "EX",
      ttlSec,
    );
    return result === "OK";
  }

  async releaseLock(lockKey: string): Promise<void> {
    await this.cmd("DEL", `${this.namespace}:lock:${lockKey}`);
  }

  async close(): Promise<void> {
    /* no-op */
  }
}

export function createStateStore(input: {
  redisUrl: string | null;
  redisNamespace: string;
  allowMemoryState: boolean;
  logDir: string;
  upstashUrl?: string | null;
  upstashToken?: string | null;
}): StateStore {
  const upstashUrl =
    input.upstashUrl ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim() ||
    null;
  const upstashToken =
    input.upstashToken ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim() ||
    null;

  if (upstashUrl && upstashToken) {
    log.info("state_backend", { backend: "redis_rest", ns: input.redisNamespace });
    return new RedisRestStateStore(upstashUrl, upstashToken, input.redisNamespace);
  }

  if (input.redisUrl) {
    log.warn("state_backend", {
      backend: "file_fallback",
      reason: "REDIS_URL set but TCP redis client not bundled; use UPSTASH_REDIS_REST_* or file state",
    });
  }

  if (!input.allowMemoryState && !upstashUrl) {
    throw new Error(
      "State store requires UPSTASH_REDIS_REST_URL+TOKEN (or KV_REST_*) or ALLOW_MEMORY_STATE=1 for file state",
    );
  }

  log.info("state_backend", { backend: "file", dir: input.logDir });
  return new FileStateStore(input.logDir);
}

export function actionKey(day: number, action: string, detail = ""): string {
  return detail ? `${day}:${action}:${detail}` : `${day}:${action}`;
}
