"use client";

import { PixelButton } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import type { WalletConnectFailReason } from "@/lib/game/walletConnect";

export type WalletConnectFeedbackProps = {
  reason: WalletConnectFailReason;
  message?: string | null;
  onDismiss: () => void;
};

/**
 * Non-modal connection status (reject / cancel / generic failure).
 * Kept separate from transaction banners and from the no-provider help modal.
 */
export function WalletConnectFeedback({
  reason,
  message,
  onDismiss,
}: WalletConnectFeedbackProps) {
  const { t } = useGameI18n();

  const body =
    reason === "rejected"
      ? t.common.walletConnectionCancelled
      : reason === "no-provider" || reason === "no-connector"
        ? t.common.walletHelpBody
        : message?.trim() || t.common.walletConnectionFailed;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[85] flex justify-center px-3"
      data-wallet-connect-feedback={reason}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto pixel-border flex w-full max-w-md items-start gap-3 bg-[#1e2433] px-3 py-3 text-sm text-[#cfd6e6] shadow-lg"
      >
        <div className="min-w-0 flex-1">
          <p className="pixel-title text-[0.65rem] tracking-[0.12em] text-[#7ec8e8]">
            {t.common.walletConnectionLabel}
          </p>
          <p className="mt-1 text-xs leading-relaxed">{body}</p>
        </div>
        <PixelButton
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          aria-label={t.common.close}
        >
          X
        </PixelButton>
      </div>
    </div>
  );
}
