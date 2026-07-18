"use client";

import { PixelButton } from "./PixelButton";
import { useGameI18n } from "@/hooks/game/useGameI18n";
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
  const { t } = useGameI18n();

  if (wallet.connected && wallet.address) {
    return (
      <PixelButton
        size={size}
        variant="slate"
        onClick={onDisconnect}
        aria-label={t.common.disconnectAria}
        className="w-full max-w-md"
        subtitle={t.common.mockTapDisconnect}
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
      aria-label={t.common.connectAria}
      className="w-full max-w-md"
      subtitle={t.common.mockNoTx}
    >
      {t.common.connectWallet}
    </PixelButton>
  );
}
