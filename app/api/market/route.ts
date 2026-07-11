import { NextResponse } from "next/server";
import { fetchEthUsd } from "@/lib/market/eth-usd";
import {
  buildSparkline,
  computeAllChanges,
  getHistoryStatus,
} from "@/lib/market/history";
import { buildMarketMetrics, readPoolMarketData } from "@/lib/market/pool";
import { maybeRecordSnapshot } from "@/lib/market/snapshots";
import type { MarketStatsResponse } from "@/lib/market/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = Date.now();
    const [pool, ethUsd] = await Promise.all([readPoolMarketData(), fetchEthUsd()]);
    const metrics = buildMarketMetrics(pool, ethUsd);

    const snapshot = {
      ts: now,
      priceEth: metrics.priceEth,
      priceUsd: metrics.priceUsd,
      tvlUsd: metrics.tvlUsd,
      marketCapUsd: metrics.marketCapUsd,
    };

    const { history, nextSnapshotInMs } = await maybeRecordSnapshot(snapshot);
    const changes = computeAllChanges(history.snapshots, metrics.priceUsd, now);

    const response: MarketStatsResponse = {
      updatedAt: now,
      priceEth: metrics.priceEth,
      priceUsd: metrics.priceUsd,
      uglyPerEth: metrics.uglyPerEth,
      marketCapUsd: metrics.marketCapUsd,
      tvlUsd: metrics.tvlUsd,
      ethUsd,
      liquidity: metrics.liquidity,
      tick: metrics.tick,
      changes,
      sparkline: buildSparkline(history.snapshots),
      historyStatus: getHistoryStatus(history.snapshots, now),
      snapshotCount: history.snapshots.length,
      nextSnapshotInMs,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load market stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
