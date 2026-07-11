import { CHANGE_WINDOWS } from "@/lib/market/constants";
import type { MarketSnapshot, PriceChangeKey } from "@/lib/market/types";

function findPriceAtOrBefore(
  snapshots: MarketSnapshot[],
  targetTs: number,
): number | null {
  let result: number | null = null;

  for (const snapshot of snapshots) {
    if (snapshot.ts <= targetTs) {
      result = snapshot.priceUsd;
      continue;
    }
    break;
  }

  return result;
}

export function computePriceChange(
  currentPriceUsd: number,
  pastPriceUsd: number | null,
): number | null {
  if (pastPriceUsd === null || pastPriceUsd <= 0 || currentPriceUsd <= 0) {
    return null;
  }
  return ((currentPriceUsd - pastPriceUsd) / pastPriceUsd) * 100;
}

export function computeAllChanges(
  snapshots: MarketSnapshot[],
  currentPriceUsd: number,
  now = Date.now(),
): Record<PriceChangeKey, number | null> {
  return {
    h1: computePriceChange(
      currentPriceUsd,
      findPriceAtOrBefore(snapshots, now - CHANGE_WINDOWS.h1),
    ),
    h24: computePriceChange(
      currentPriceUsd,
      findPriceAtOrBefore(snapshots, now - CHANGE_WINDOWS.h24),
    ),
    d7: computePriceChange(
      currentPriceUsd,
      findPriceAtOrBefore(snapshots, now - CHANGE_WINDOWS.d7),
    ),
  };
}

export function buildSparkline(
  snapshots: MarketSnapshot[],
  maxPoints = 96,
): { ts: number; priceUsd: number }[] {
  if (!snapshots.length) return [];

  const slice = snapshots.slice(-maxPoints);
  return slice.map((snapshot) => ({
    ts: snapshot.ts,
    priceUsd: snapshot.priceUsd,
  }));
}

export function getHistoryStatus(
  snapshots: MarketSnapshot[],
  now = Date.now(),
): "ready" | "building" {
  if (snapshots.length < 2) return "building";

  const oldest = snapshots[0]?.ts ?? now;
  const hasDay = oldest <= now - CHANGE_WINDOWS.h24;
  return hasDay ? "ready" : "building";
}

export function hasWindowCoverage(
  snapshots: MarketSnapshot[],
  windowMs: number,
  now = Date.now(),
): boolean {
  if (!snapshots.length) return false;
  return snapshots[0]!.ts <= now - windowMs;
}
