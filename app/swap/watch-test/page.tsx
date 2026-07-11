"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useConnection, useWalletClient } from "wagmi";
import { PROJECT } from "@/content/project";
import { TOKEN_WALLET_LOGO_URL, buildWalletWatchAssetRequest, requestWatchTokenAsset } from "@/lib/wallet/watchAsset";

export default function WatchAssetTestPage() {
  const { isConnected } = useConnection();
  const { data: walletClient } = useWalletClient();
  const [log, setLog] = useState<string>("Ready. Open DevTools Console for full payload.");

  const payload = buildWalletWatchAssetRequest();

  const runTest = useCallback(async () => {
    if (!walletClient) {
      setLog("Connect wallet first.");
      return;
    }

    try {
      const added = await requestWatchTokenAsset(walletClient);
      setLog(
        added
          ? `Success — ${PROJECT.symbol} added. Open MetaMask token list and confirm logo loads from logo-256.png.`
          : "Request completed but user declined or token already exists.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${PROJECT.symbol}] watch-test failed:`, error);
      setLog(`Failed: ${message}`);
    }
  }, [walletClient]);

  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-foreground">
      <Link href="/swap" className="text-sm text-muted hover:text-gold-light">
        ← Back to Swap
      </Link>

      <h1 className="mt-8 font-[family-name:var(--font-anton)] text-2xl tracking-[0.12em]">
        wallet_watchAsset Test
      </h1>
      <p className="mt-4 text-sm text-muted">
        Dev helper for MetaMask EIP-747. Uses <code className="text-gold-light">wallet_watchAsset</code>{" "}
        with {TOKEN_WALLET_LOGO_URL}.
      </p>

      <pre className="mt-6 overflow-x-auto rounded-xl border-2 border-wood/40 bg-wood/10 p-4 text-xs text-muted">
        {JSON.stringify(payload, null, 2)}
      </pre>

      <button
        type="button"
        onClick={() => void runTest()}
        disabled={!isConnected || !walletClient}
        className="pixel-btn mt-6 w-full border-wood bg-gold/20 px-6 py-3 font-[family-name:var(--font-anton)] text-sm tracking-[0.15em] text-gold-light disabled:opacity-50"
      >
        {isConnected ? "Run wallet_watchAsset" : "Connect wallet on /swap first"}
      </button>

      <p className="mt-4 text-sm text-muted" role="status">
        {log}
      </p>
    </main>
  );
}
