"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { WalletHelpModal } from "@/components/game/WalletHelpModal";
import {
  useOpenWalletConnect,
  type WalletConnectResult,
} from "@/hooks/game/useOpenWalletConnect";

type WalletConnectContextValue = {
  openWalletConnect: () => Promise<WalletConnectResult>;
  isConnecting: boolean;
  connectError: string | null;
  clearError: () => void;
  hasInjectedProvider: boolean;
  connectorIds: string[];
};

const WalletConnectContext = createContext<WalletConnectContextValue | null>(null);

export function WalletConnectProvider({
  children,
  chainId,
}: {
  children: ReactNode;
  /** Target chain for connectAsync (game defaults to genesis/game chain). */
  chainId?: number;
}) {
  const {
    openWalletConnect,
    isConnecting,
    connectError,
    clearError,
    helpOpen,
    closeHelp,
    hasInjectedProvider,
    connectorIds,
  } = useOpenWalletConnect(chainId);

  const value = useMemo(
    () => ({
      openWalletConnect,
      isConnecting,
      connectError,
      clearError,
      hasInjectedProvider,
      connectorIds,
    }),
    [
      openWalletConnect,
      isConnecting,
      connectError,
      clearError,
      hasInjectedProvider,
      connectorIds,
    ],
  );

  return (
    <WalletConnectContext.Provider value={value}>
      {children}
      <WalletHelpModal open={helpOpen} onClose={closeHelp} message={connectError} />
    </WalletConnectContext.Provider>
  );
}

/** Prefer this (or useWalletUi().connectWallet) for every CONNECT WALLET entry point. */
export function useWalletConnectAction(): WalletConnectContextValue {
  const ctx = useContext(WalletConnectContext);
  if (!ctx) {
    throw new Error("useWalletConnectAction must be used within WalletConnectProvider");
  }
  return ctx;
}

/** Safe optional access when provider may be absent (e.g. isolated tests). */
export function useOptionalWalletConnectAction(): WalletConnectContextValue | null {
  return useContext(WalletConnectContext);
}

export function useConnectWalletClick(): () => void {
  const { openWalletConnect } = useWalletConnectAction();
  return useCallback(() => {
    void openWalletConnect();
  }, [openWalletConnect]);
}
