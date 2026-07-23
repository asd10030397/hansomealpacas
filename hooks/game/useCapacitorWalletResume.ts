"use client";

import { useEffect } from "react";
import { useReconnect } from "wagmi";
import { isCapacitorNative } from "@/lib/game/capacitorEnv";

/**
 * When the Capacitor shell returns from MetaMask/OKX, re-sync wagmi from the
 * WalletConnect relay (WebView has no injected EIP-1193 provider).
 */
export function useCapacitorWalletResume() {
  const { reconnect } = useReconnect();

  useEffect(() => {
    if (!isCapacitorNative()) return;

    const sync = () => {
      void reconnect();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [reconnect]);
}
