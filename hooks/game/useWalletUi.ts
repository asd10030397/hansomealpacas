"use client";

import { useCallback, useMemo } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
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
 * Live wallet UI via wagmi (injected). Game layout must wrap with Web3Provider.
 */
export function useWalletUi() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

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
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (!injected) return;
    connect({ connector: injected });
  }, [connect, connectors]);

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
    isPending: isPending || isSwitching,
    connectError,
    isMock: false as const,
  };
}
