import { NextResponse } from "next/server";
import { fetchGeckoTerminalPoolStats } from "@/lib/market/geckoterminal";
import type { MarketStatsResponse } from "@/lib/market/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await fetchGeckoTerminalPoolStats();

    const response: MarketStatsResponse = {
      source: "geckoterminal",
      updatedAt: stats.updatedAt,
      poolName: stats.poolName,
      priceUsd: stats.priceUsd,
      priceEth: stats.priceEth,
      change24h: stats.change24h,
      volume24hUsd: stats.volume24hUsd,
      liquidityUsd: stats.liquidityUsd,
      transactions24h: stats.transactions24h,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[UGLY] /api/market failed:", error);
    const message = error instanceof Error ? error.message : "Failed to load market stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
