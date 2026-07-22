/**
 * Client-side Commit secret vault.
 * Salt + location must survive until Reveal; never send salt on-chain at Commit.
 * Secrets are scoped per wallet so switching accounts cannot leak another user's moves.
 */

import { toHex, type Hex } from "viem";
import type { LocationId } from "@/types/game";
import { computeCommitHash } from "@/lib/game/commitHash";

export { computeCommitHash };

const STORAGE_KEY = "hansome-commit-secrets-v2";
/** Legacy unscoped vault — read once for migration, never written. */
const LEGACY_STORAGE_KEY = "hansome-commit-secrets-v1";
const PENDING_LOCATION_KEY = "hansome-pending-location-v1";
const ACTIVE_WALLET_KEY = "hansome-active-wallet-v1";

export type CommitSecretRecord = {
  tokenId: number;
  day: number;
  locationId: LocationId;
  salt: Hex;
  commitHash: Hex;
  /** Lowercase wallet that created this secret. */
  wallet: string;
  /** prepared = local only; submitted = tx sent / demo sealed */
  status: "prepared" | "submitted" | "revealed";
  txHash?: Hex;
  updatedAt: number;
};

export function normalizeWallet(wallet: string | null | undefined): string | null {
  if (!wallet?.trim()) return null;
  return wallet.trim().toLowerCase();
}

export function generateSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function readAll(): CommitSecretRecord[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CommitSecretRecord[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (r) =>
          r &&
          typeof r.tokenId === "number" &&
          typeof r.day === "number" &&
          typeof r.wallet === "string" &&
          r.wallet.length > 0,
      );
    }
    // One-time: drop legacy unscoped secrets (cannot safely attribute to a wallet).
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return [];
  } catch {
    return [];
  }
}

function writeAll(records: CommitSecretRecord[]): void {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function secretKey(tokenId: number, day: number, wallet: string): string {
  return `${normalizeWallet(wallet)}:${day}:${tokenId}`;
}

export function getCommitSecret(
  tokenId: number,
  day: number,
  wallet?: string | null,
): CommitSecretRecord | null {
  const w = normalizeWallet(wallet);
  if (!w) return null;
  return (
    readAll().find(
      (r) => r.tokenId === tokenId && r.day === day && r.wallet === w,
    ) ?? null
  );
}

export function listCommitSecretsForDay(
  day: number,
  wallet?: string | null,
): CommitSecretRecord[] {
  const w = normalizeWallet(wallet);
  if (!w) return [];
  return readAll().filter((r) => r.day === day && r.wallet === w);
}

/** Secrets for this wallet that also appear in `ownedTokenIds`. */
export function listOwnedCommitSecretsForDay(
  day: number,
  wallet: string | null | undefined,
  ownedTokenIds: readonly number[],
): CommitSecretRecord[] {
  const owned = new Set(ownedTokenIds);
  return listCommitSecretsForDay(day, wallet).filter((r) =>
    owned.has(r.tokenId),
  );
}

/** Drop a stale local secret (e.g. no matching on-chain commit). */
export function removeCommitSecret(
  tokenId: number,
  day: number,
  wallet: string | null | undefined,
): boolean {
  const w = normalizeWallet(wallet);
  if (!w) return false;
  const all = readAll();
  const kept = all.filter(
    (r) => !(r.tokenId === tokenId && r.day === day && r.wallet === w),
  );
  if (kept.length === all.length) return false;
  writeAll(kept);
  return true;
}

export function upsertCommitSecret(
  input: Omit<CommitSecretRecord, "updatedAt" | "commitHash" | "wallet"> & {
    commitHash?: Hex;
    wallet: string;
  },
): CommitSecretRecord {
  const w = normalizeWallet(input.wallet);
  if (!w) {
    throw new Error("Commit secret requires a connected wallet address.");
  }
  const salt = input.salt;
  const commitHash =
    input.commitHash ??
    computeCommitHash(input.tokenId, input.day, input.locationId, salt);
  const next: CommitSecretRecord = {
    tokenId: input.tokenId,
    day: input.day,
    locationId: input.locationId,
    salt,
    commitHash,
    wallet: w,
    status: input.status,
    txHash: input.txHash,
    updatedAt: Date.now(),
  };
  const others = readAll().filter(
    (r) =>
      !(r.tokenId === next.tokenId && r.day === next.day && r.wallet === w),
  );
  writeAll([...others, next]);
  return next;
}

/**
 * Call when the connected account changes.
 * Clears Explore→Commit handoff and records the active wallet for the session.
 * Does not delete other wallets' secrets (so switching back still works).
 */
export function onWalletAccountChange(address: string | null | undefined): void {
  if (typeof sessionStorage === "undefined") return;
  const next = normalizeWallet(address) ?? "";
  const prev = sessionStorage.getItem(ACTIVE_WALLET_KEY) ?? "";
  if (prev === next) return;
  sessionStorage.setItem(ACTIVE_WALLET_KEY, next);
  setPendingLocation(null);
}

type PendingLocationRecord = {
  day: number;
  locationId: LocationId;
};

/** Explore → Commit handoff (session), scoped to a game day. */
export function setPendingLocation(
  locationId: LocationId | null,
  day?: number,
): void {
  if (typeof sessionStorage === "undefined") return;
  if (locationId == null) {
    sessionStorage.removeItem(PENDING_LOCATION_KEY);
    return;
  }
  if (day != null && Number.isInteger(day) && day >= 0) {
    const record: PendingLocationRecord = { day, locationId };
    sessionStorage.setItem(PENDING_LOCATION_KEY, JSON.stringify(record));
    return;
  }
  // Legacy write without day — cleared on next day sync.
  sessionStorage.setItem(PENDING_LOCATION_KEY, String(locationId));
}

/**
 * Read Explore→Commit handoff. When `day` is provided, only returns a match
 * for that day (prevents Day N location leaking into Day N+1).
 */
export function getPendingLocation(day?: number): LocationId | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_LOCATION_KEY);
  if (raw == null) return null;

  try {
    const parsed = JSON.parse(raw) as PendingLocationRecord;
    if (
      parsed &&
      typeof parsed.day === "number" &&
      typeof parsed.locationId === "number"
    ) {
      if (!Number.isInteger(parsed.locationId) || parsed.locationId < 0 || parsed.locationId > 4) {
        return null;
      }
      if (day != null && parsed.day !== day) return null;
      return parsed.locationId as LocationId;
    }
  } catch {
    /* legacy plain number */
  }

  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 4) return null;
  // Legacy unscoped value: only honor when caller is not day-checking.
  if (day != null) return null;
  return n as LocationId;
}

/** Drop commit secrets that are not for `currentDay`. */
export function pruneCommitSecretsNotForDay(currentDay: number): number {
  if (!Number.isInteger(currentDay) || currentDay < 0) return 0;
  const all = readAll();
  const kept = all.filter((r) => r.day === currentDay);
  const removed = all.length - kept.length;
  if (removed > 0) writeAll(kept);
  return removed;
}

/**
 * Call when the UI clock advances to a new game day.
 * Clears prior-day commit secrets and Explore→Commit location handoff.
 */
export function syncGameplayDayClientState(currentDay: number): void {
  pruneCommitSecretsNotForDay(currentDay);
  if (typeof sessionStorage === "undefined") return;
  // Keep only a pending location that was sealed for this day.
  if (getPendingLocation(currentDay) == null) {
    sessionStorage.removeItem(PENDING_LOCATION_KEY);
  }
}
