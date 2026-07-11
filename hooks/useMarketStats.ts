"use client";

import { useCallback, useEffect, useState } from "react";
import { MARKET_REFRESH_MS } from "@/lib/market/constants";
import type { MarketStatsResponse } from "@/lib/market/types";

export function useMarketStats() {
  const [data, setData] = useState<MarketStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/market", { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      const json = (await response.json()) as MarketStatsResponse;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market stats");
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

  return { data, error, isLoading, refresh: fetchStats };
}
