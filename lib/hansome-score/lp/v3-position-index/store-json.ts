/**
 * Node JSON file helpers for Phase 10B offline validation scripts.
 * Not imported by Production scan path (keeps node:fs out of Next bundles).
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import {
  validateV3PosIndexRecord,
  V3PosStoreError,
} from "@/lib/hansome-score/lp/v3-position-index/store";
import type { V3PosIndexRecord } from "@/lib/hansome-score/lp/v3-position-index/types";

export function loadV3PosIndexJson(filePath: string): V3PosIndexRecord | null {
  if (!existsSync(filePath)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new V3PosStoreError("JSON parse failed", "CORRUPTED");
  }
  return validateV3PosIndexRecord(parsed);
}

export function saveV3PosIndexJson(
  filePath: string,
  record: V3PosIndexRecord,
): void {
  validateV3PosIndexRecord(record);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(record, null, 2), "utf8");
}
