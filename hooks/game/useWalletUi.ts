"use client";

import { useCallback, useState } from "react";
import { MOCK_WALLET } from "@/data/game/mock";
import type { WalletUiState } from "@/types/game";

/**
 * Placeholder wallet UI state.
 * TODO(wagmi): replace with useAccount / useConnect / useDisconnect.
 */
export function useWalletUi() {
  const [wallet, setWallet] = useState<WalletUiState>(MOCK_WALLET);

  const connectMock = useCallback(() => {
    setWallet({
      connected: true,
      address: "0xDEMO…c0ffee",
      networkLabel: "ROBINHOOD CHAIN",
      isMock: true,
    });
  }, []);

  const disconnectMock = useCallback(() => {
    setWallet(MOCK_WALLET);
  }, []);

  return { wallet, connectMock, disconnectMock, isMock: true as const };
}
