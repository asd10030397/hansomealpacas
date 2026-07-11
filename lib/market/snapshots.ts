import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  SNAPSHOT_INTERVAL_MS,
  SNAPSHOT_RETENTION_MS,
} from "@/lib/market/constants";
import type { MarketHistoryFile, MarketSnapshot } from "@/lib/market/types";

const HISTORY_PATH = path.join(process.cwd(), "data", "market-history.json");

function emptyHistory(): MarketHistoryFile {
  return { version: 1, snapshots: [] };
}

export async function loadMarketHistory(): Promise<MarketHistoryFile> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf8");
    const parsed = JSON.parse(raw) as MarketHistoryFile;
    if (!parsed?.snapshots || !Array.isArray(parsed.snapshots)) {
      return emptyHistory();
    }
    return {
      version: 1,
      snapshots: parsed.snapshots
        .filter(
          (item) =>
            typeof item.ts === "number" &&
            typeof item.priceEth === "number" &&
            typeof item.priceUsd === "number",
        )
        .sort((a, b) => a.ts - b.ts),
    };
  } catch {
    return emptyHistory();
  }
}

async function saveMarketHistory(history: MarketHistoryFile): Promise<void> {
  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2), "utf8");
}

function trimSnapshots(snapshots: MarketSnapshot[]): MarketSnapshot[] {
  const cutoff = Date.now() - SNAPSHOT_RETENTION_MS;
  return snapshots.filter((snapshot) => snapshot.ts >= cutoff);
}

export async function maybeRecordSnapshot(
  snapshot: MarketSnapshot,
): Promise<{ history: MarketHistoryFile; recorded: boolean; nextSnapshotInMs: number }> {
  const history = await loadMarketHistory();
  const last = history.snapshots.at(-1);
  const now = snapshot.ts;

  if (last && now - last.ts < SNAPSHOT_INTERVAL_MS) {
    return {
      history,
      recorded: false,
      nextSnapshotInMs: SNAPSHOT_INTERVAL_MS - (now - last.ts),
    };
  }

  const nextHistory: MarketHistoryFile = {
    version: 1,
    snapshots: trimSnapshots([...history.snapshots, snapshot]),
  };

  await saveMarketHistory(nextHistory);

  return {
    history: nextHistory,
    recorded: true,
    nextSnapshotInMs: SNAPSHOT_INTERVAL_MS,
  };
}
