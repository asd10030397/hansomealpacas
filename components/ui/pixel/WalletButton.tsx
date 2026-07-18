"use client";

import { PixelButton } from "./PixelButton";
import type { WalletUiState } from "@/types/game";

export function WalletButton({
  wallet,
  onConnect,
  onDisconnect,
  size = "sm",
}: {
  wallet: WalletUiState;
  onConnect: () => void;
  onDisconnect: () => void;
  size?: "sm" | "md" | "lg";
}) {
  if (wallet.connected && wallet.address) {
    return (
      <PixelButton
        size={size}
        variant="slate"
        onClick={onDisconnect}
        aria-label="Disconnect mock wallet"
        className="w-full max-w-md"
        subtitle="MOCK · TAP TO DISCONNECT"
      >
        {wallet.address}
      </PixelButton>
    );
  }
  return (
    <PixelButton
      size={size}
      variant="gold"
      onClick={onConnect}
      aria-label="Connect wallet (mock)"
      className="w-full max-w-md"
      subtitle="MOCK WALLET · NO TX"
    >
      CONNECT WALLET
    </PixelButton>
  );
}
