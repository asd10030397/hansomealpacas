"use client";

import { useCallback, useMemo } from "react";
import {
  useAccount,
  useChainId,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { useWalletConnectAction } from "@/context/WalletConnectContext";
import { GENESIS_CHAIN_ID } from "@/lib/game/genesis";
import { robinhoodChain, robinhoodTestnetChain } from "@/lib/chain";
import type { WalletUiState } from "@/types/game";

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function networkLabelFor(chainId: number | undefined): string {
  if (chainId === robinhoodTestnetChain.id) return "ROBINHOOD TESTNET";
  if (chainId === robinhoodChain.id) return "ROBINHOOD CHAIN";
  if (!chainId) return "NO NETWORK";
  return `CHAIN ${chainId}`;
}

/**
 * Live wallet UI via wagmi (injected). Game layout must wrap with
 * Web3Provider + WalletConnectProvider so connect never fails silently.
 */
export function useWalletUi() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { openWalletConnect, isConnecting, connectError } = useWalletConnectAction();

  const wallet: WalletUiState = useMemo(
    () => ({
      connected: isConnected && Boolean(address),
      address: address ? shortenAddress(address) : null,
      fullAddress: address ?? null,
      networkLabel: networkLabelFor(chainId),
      chainId,
      isMock: false,
      wrongNetwork: isConnected && chainId !== GENESIS_CHAIN_ID,
    }),
    [address, chainId, isConnected],
  );

  const connectWallet = useCallback(() => {
    void openWalletConnect();
  }, [openWalletConnect]);

  const disconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const switchToGenesisChain = useCallback(() => {
    switchChain({ chainId: GENESIS_CHAIN_ID });
  }, [switchChain]);

  return {
    wallet,
    connectMock: connectWallet,
    disconnectMock: disconnectWallet,
    connectWallet,
    disconnectWallet,
    switchToGenesisChain,
    isPending: isConnecting || isSwitching,
    connectError,
    isMock: false as const,
  };
}
