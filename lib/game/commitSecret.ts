/**
 * Client-side Commit secret vault.
 * Salt + location must survive until Reveal; never send salt on-chain at Commit.
 */

import { encodePacked, keccak256, toHex, type Hex } from "viem";
import type { LocationId } from "@/types/game";

const STORAGE_KEY = "hansome-commit-secrets-v1";
const PENDING_LOCATION_KEY = "hansome-pending-location-v1";

export type CommitSecretRecord = {
  tokenId: number;
  day: number;
  locationId: LocationId;
  salt: Hex;
  commitHash: Hex;
  /** prepared = local only; submitted = tx sent / demo sealed */
  status: "prepared" | "submitted" | "revealed";
  txHash?: Hex;
  updatedAt: number;
};

export function computeCommitHash(
  tokenId: number,
  day: number,
  locationId: LocationId,
  salt: Hex,
): Hex {
  return keccak256(
    encodePacked(
      ["uint256", "uint256", "uint8", "bytes32"],
      [BigInt(tokenId), BigInt(day), locationId, salt],
    ),
  );
}

export function generateSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function readAll(): CommitSecretRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommitSecretRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(records: CommitSecretRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function secretKey(tokenId: number, day: number): string {
  return `${day}:${tokenId}`;
}

export function getCommitSecret(
  tokenId: number,
  day: number,
): CommitSecretRecord | null {
  return (
    readAll().find((r) => r.tokenId === tokenId && r.day === day) ?? null
  );
}

export function listCommitSecretsForDay(day: number): CommitSecretRecord[] {
  return readAll().filter((r) => r.day === day);
}

export function upsertCommitSecret(
  input: Omit<CommitSecretRecord, "updatedAt" | "commitHash"> & {
    commitHash?: Hex;
  },
): CommitSecretRecord {
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
    status: input.status,
    txHash: input.txHash,
    updatedAt: Date.now(),
  };
  const others = readAll().filter(
    (r) => !(r.tokenId === next.tokenId && r.day === next.day),
  );
  writeAll([...others, next]);
  return next;
}

/** Explore → Commit handoff (session). */
export function setPendingLocation(locationId: LocationId | null): void {
  if (typeof window === "undefined") return;
  if (locationId == null) {
    sessionStorage.removeItem(PENDING_LOCATION_KEY);
    return;
  }
  sessionStorage.setItem(PENDING_LOCATION_KEY, String(locationId));
}

export function getPendingLocation(): LocationId | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_LOCATION_KEY);
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 4) return null;
  return n as LocationId;
}
