"use client";

import { useCallback, useState } from "react";
import { useConnect } from "wagmi";
import { GENESIS_CHAIN_ID } from "@/lib/game/genesis";
import {
  classifyConnectFailure,
  hasInjectedEthereum,
  NO_WALLET_CONNECT_MESSAGE,
  pickConnectConnector,
  preflightWalletConnect,
  type WalletConnectFailReason,
} from "@/lib/game/walletConnect";

export type { WalletConnectFailReason };

export type WalletConnectResult =
  | { ok: true }
  | { ok: false; error: string; reason: WalletConnectFailReason };

/**
 * Single shared wallet-connect action for header, home CTA, mint, My NFTs, swap, etc.
 * Never fails silently — always returns / surfaces an error string.
 *
 * @param targetChainId — defaults to game/genesis chain; swap passes Robinhood Mainnet id.
 */
export function useOpenWalletConnect(targetChainId: number = GENESIS_CHAIN_ID) {
  const { connectAsync, connectors, isPending } = useConnect();
  const [error, setError] = useState<string | null>(null);
  const [failReason, setFailReason] = useState<WalletConnectFailReason | null>(
    null,
  );
  const [helpOpen, setHelpOpen] = useState(false);

  const clearError = useCallback(() => {
    setError(null);
    setFailReason(null);
  }, []);
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
  }, []);

  const openWalletConnect = useCallback(async (): Promise<WalletConnectResult> => {
    setError(null);
    setFailReason(null);

    const ethereum =
      typeof window !== "undefined"
        ? (window as Window & { ethereum?: unknown }).ethereum
        : undefined;
    const hasProvider = hasInjectedEthereum(ethereum);

    if (process.env.NODE_ENV === "development") {
      console.info("[wallet-connect]", {
        host: typeof window !== "undefined" ? window.location.host : null,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        connectors: connectors.map((c) => c.id),
        hasInjectedProvider: hasProvider,
        targetChainId,
      });
    }

    const preflight = preflightWalletConnect({ connectors, hasProvider });
    if (!preflight.ok) {
      setError(preflight.error);
      setFailReason(preflight.reason);
      setHelpOpen(true);
      return preflight;
    }

    const connector = pickConnectConnector(connectors, hasProvider);
    if (!connector) {
      setError(NO_WALLET_CONNECT_MESSAGE);
      setFailReason("no-connector");
      setHelpOpen(true);
      return { ok: false, error: NO_WALLET_CONNECT_MESSAGE, reason: "no-connector" };
    }

    try {
      await connectAsync({
        connector,
        chainId: targetChainId,
      });
      setHelpOpen(false);
      return { ok: true };
    } catch (e) {
      const { message, reason } = classifyConnectFailure(e);
      setError(message);
      setFailReason(reason);
      // Reject/cancel → non-modal feedback only (not silent, not help modal).
      if (reason !== "rejected") setHelpOpen(true);
      return { ok: false, error: message, reason };
    }
  }, [connectAsync, connectors, targetChainId]);

  return {
    openWalletConnect,
    isConnecting: isPending,
    connectError: error,
    connectFailReason: failReason,
    clearError,
    helpOpen,
    closeHelp,
    hasInjectedProvider:
      typeof window !== "undefined"
        ? hasInjectedEthereum((window as Window & { ethereum?: unknown }).ethereum)
        : false,
    connectorIds: connectors.map((c) => c.id),
  };
}
