"use client";

import { useCallback, useEffect, useState } from "react";
import { PROJECT } from "@/content/project";

const WALLET_BALANCES_REFRESH_MS = 60 * 1000;

export type WalletBalancesResponse = {
  updatedAt: string;
  balances: { id: string; hansome: string }[];
};

export function useWalletBalances() {
  const [data, setData] = useState<WalletBalancesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const fetchBalances = useCallback(async () => {
    try {
      const response = await fetch("/api/wallets", { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      const json = (await response.json()) as WalletBalancesResponse;
      setData(json);
      setHasError(false);
    } catch (err) {
      console.error(`[${PROJECT.symbol}] wallet balances fetch failed:`, err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBalances();
    const timer = window.setInterval(() => {
      void fetchBalances();
    }, WALLET_BALANCES_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchBalances]);

  return { data, isLoading, hasError };
}
