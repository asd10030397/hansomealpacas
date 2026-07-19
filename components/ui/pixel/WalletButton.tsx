"use client";

import { PixelButton } from "./PixelButton";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import type { WalletUiState } from "@/types/game";

function shortAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton({
  wallet,
  onConnect,
  onDisconnect,
  size = "sm",
  /** Header/mobile: single-line label, no injected-wallet subtitle stack. */
  compact = false,
  disabled = false,
}: {
  wallet: WalletUiState;
  onConnect: () => void;
  onDisconnect: () => void;
  size?: "sm" | "md" | "lg";
  compact?: boolean;
  disabled?: boolean;
}) {
  const { t } = useGameI18n();

  if (wallet.connected && wallet.address) {
    return (
      <PixelButton
        size={size}
        variant="slate"
        onClick={onDisconnect}
        disabled={disabled}
        aria-label={t.common.disconnectAria}
        className={compact ? "game-wallet-btn game-wallet-btn--compact" : "w-full max-w-md"}
        subtitle={
          compact
            ? undefined
            : wallet.isMock
              ? t.common.mockTapDisconnect
              : t.common.tapDisconnect
        }
      >
        {compact ? shortAddress(wallet.address) : wallet.address}
      </PixelButton>
    );
  }

  return (
    <PixelButton
      size={size}
      variant="gold"
      onClick={onConnect}
      disabled={disabled}
      data-wallet-entry="header-or-shared"
      aria-label={t.common.connectAria}
      className={compact ? "game-wallet-btn game-wallet-btn--compact" : "w-full max-w-md"}
      subtitle={
        compact ? undefined : wallet.isMock ? t.common.mockNoTx : t.common.injectedWalletSub
      }
    >
      {t.common.connectWallet}
    </PixelButton>
  );
}
