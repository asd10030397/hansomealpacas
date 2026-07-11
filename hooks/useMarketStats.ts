"use client";

import { useCallback, useEffect, useState } from "react";
import { PROJECT } from "@/content/project";
import { MARKET_REFRESH_MS } from "@/lib/market/constants";
import type { MarketStatsResponse } from "@/lib/market/types";

export function useMarketStats() {
  const [data, setData] = useState<MarketStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/market", { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      const json = (await response.json()) as MarketStatsResponse;
      setData(json);
      setHasError(false);
    } catch (err) {
      console.error(`[${PROJECT.symbol}] market stats fetch failed:`, err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const timer = window.setInterval(() => {
      void fetchStats();
    }, MARKET_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchStats]);

  return { data, isLoading, hasError, refresh: fetchStats };
}
