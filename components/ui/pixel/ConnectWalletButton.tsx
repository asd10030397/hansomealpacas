"use client";

import { WalletButton } from "./WalletButton";
import { useWalletUi } from "@/hooks/game/useWalletUi";

/**
 * Shared CONNECT WALLET control — same connect path on mobile and desktop.
 * Renders via WalletConnectProvider help modal on failure (never silent).
 */
export function ConnectWalletButton({
  size = "sm",
  compact = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  compact?: boolean;
  className?: string;
}) {
  const { wallet, connectWallet, disconnectWallet, isPending } = useWalletUi();

  return (
    <span className={className} data-wallet-entry="connect-wallet-button">
      <WalletButton
        wallet={wallet}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
        size={size}
        compact={compact}
        disabled={isPending}
      />
    </span>
  );
}
