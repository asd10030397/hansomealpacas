"use client";

import { useEffect, useId, useRef } from "react";
import { PixelButton } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { OFFICIAL_TELEGRAM_URL, OFFICIAL_X_URL } from "@/lib/links";

export type ComingSoonModalProps = {
  open: boolean;
  onClose: () => void;
  /** Optional feature label shown under the title (e.g. "Marketplace"). */
  feature?: string;
};

/**
 * Reusable pixel "Coming Soon" modal for unimplemented game features.
 * Replace the trigger with a real action when the feature ships.
 */
export function ComingSoonModal({ open, onClose, feature }: ComingSoonModalProps) {
  const { t } = useGameI18n();
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
          <h2 id={titleId} className="pixel-title text-sm text-[#f0c44a] sm:text-base">
            {t.common.comingSoonTitle}
          </h2>
          <PixelButton size="sm" variant="ghost" onClick={onClose} aria-label={t.common.close}>
            X
          </PixelButton>
        </div>

        {feature ? <p className="mock-chip mb-3">{feature}</p> : null}

        <div className="space-y-3 text-sm leading-relaxed text-[#cfd6e6]">
          <p>{t.common.comingSoonBody1}</p>
          <p>{t.common.comingSoonBody2}</p>
          <p className="text-[#f0c44a]">{t.common.comingSoonBody3}</p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <PixelButton variant="slate" className="w-full sm:min-w-[7rem] sm:flex-1" onClick={onClose}>
            {t.common.close}
          </PixelButton>
          <PixelButton
            variant="gold"
            className="w-full sm:min-w-[7rem] sm:flex-1"
            href={OFFICIAL_X_URL}
          >
            {t.common.followX}
          </PixelButton>
          <PixelButton
            variant="green"
            className="w-full sm:min-w-[7rem] sm:flex-1"
            href={OFFICIAL_TELEGRAM_URL}
          >
            {t.common.joinTelegram}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
