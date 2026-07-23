"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { PixelButton } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { metamaskDappDeepLink, okxDappDeepLink } from "@/lib/game/walletConnect";
import { isCapacitorNative } from "@/lib/game/capacitorEnv";
import { forceUnlockBodyScroll, lockBodyScroll, unlockBodyScroll } from "@/lib/ui/bodyScrollLock";

export type WalletHelpModalProps = {
  open: boolean;
  onClose: () => void;
  message?: string | null;
  /** Capacitor + WalletConnect: deep links do not establish a session — retry WC instead. */
  hideDeepLinks?: boolean;
  onRetry?: () => void;
};

function currentPageUrl(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.href;
}

function metamaskDappLink(): string | null {
  if (typeof window === "undefined") return null;
  return metamaskDappDeepLink(
    window.location.host,
    `${window.location.pathname}${window.location.search}`,
  );
}

function okxDappLink(): string | null {
  const page = currentPageUrl();
  return page ? okxDappDeepLink(page) : null;
}

/**
 * In-page help when no injected wallet is available (mobile Safari / Telegram).
 * Does not use window.open — safe for in-app browsers.
 */
export function WalletHelpModal({
  open,
  onClose,
  message,
  hideDeepLinks = false,
  onRetry,
}: WalletHelpModalProps) {
  const { t } = useGameI18n();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const showDeepLinks = !hideDeepLinks && !isCapacitorNative();
  const mmLink = useMemo(
    () => (open && showDeepLinks ? metamaskDappLink() : null),
    [open, showDeepLinks],
  );
  const okxLink = useMemo(
    () => (open && showDeepLinks ? okxDappLink() : null),
    [open, showDeepLinks],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    lockBodyScroll();
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      forceUnlockBodyScroll();
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-3 sm:items-center"
      role="presentation"
      data-wallet-help-modal="open"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="coming-soon-pop pixel-border w-full max-w-md bg-[#1e2433] p-4 outline-none sm:p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="pixel-title text-sm text-[#7ec8e8] sm:text-base">
            {t.common.walletHelpTitle}
          </h2>
          <PixelButton size="sm" variant="ghost" onClick={onClose} aria-label={t.common.close}>
            X
          </PixelButton>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-[#cfd6e6]">
          <p role="alert">{message || t.common.walletHelpBody}</p>
          <p className="text-[var(--hg-muted)]">{t.common.walletHelpHint}</p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {onRetry && (hideDeepLinks || isCapacitorNative()) ? (
            <PixelButton variant="gold" className="w-full" onClick={onRetry}>
              {t.common.connectWallet}
            </PixelButton>
          ) : null}
          {mmLink ? (
            <PixelButton variant="gold" className="w-full" href={mmLink}>
              {t.common.openInMetaMask}
            </PixelButton>
          ) : null}
          {okxLink ? (
            <PixelButton variant="slate" className="w-full" href={okxLink}>
              {t.common.openInOkx}
            </PixelButton>
          ) : null}
          <PixelButton variant="ghost" className="w-full" onClick={onClose}>
            {t.common.close}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
