"use client";

import { useEffect, useId, useRef } from "react";
import { PixelButton } from "@/components/ui/pixel";

export type WalletRequiredModalProps = {
  open: boolean;
  onClose: () => void;
  onConnect: () => void;
  feature?: string;
};

/**
 * Shown when a feature is ready in the UI but needs a connected wallet.
 * Distinct from ComingSoonModal (unimplemented features).
 */
export function WalletRequiredModal({
  open,
  onClose,
  onConnect,
  feature,
}: WalletRequiredModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-3 sm:items-center"
      role="presentation"
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
            🔗 Wallet Required
          </h2>
          <PixelButton size="sm" variant="ghost" onClick={onClose} aria-label="Close dialog">
            X
          </PixelButton>
        </div>

        {feature ? <p className="mock-chip mb-3">{feature}</p> : null}

        <div className="space-y-3 text-sm leading-relaxed text-[#cfd6e6]">
          <p>Connect your wallet to use this feature.</p>
          <p className="text-[var(--hg-muted)]">
            Demo mode uses a mock wallet only — no production contracts are connected yet.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <PixelButton variant="slate" className="w-full sm:flex-1" onClick={onClose}>
            Close
          </PixelButton>
          <PixelButton
            variant="gold"
            className="w-full sm:flex-1"
            onClick={() => {
              onConnect();
              onClose();
            }}
          >
            CONNECT WALLET
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
