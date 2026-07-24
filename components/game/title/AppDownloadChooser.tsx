"use client";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { ANDROID_APK_STABLE_PATH } from "@/lib/androidDownload";
import { forceUnlockBodyScroll, lockBodyScroll, unlockBodyScroll } from "@/lib/ui/bodyScrollLock";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AppDownloadChooser({ open, onClose }: Props) {
  const { t } = useGameI18n();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

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
      forceUnlockBodyScroll();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="standoff-download"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        className="standoff-download__backdrop"
        aria-label={t.common.close}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="standoff-download__panel"
      >
        <div className="standoff-download__header">
          <h2 id={titleId} className="standoff-download__title">
            {t.title.downloadAppChooserTitle}
          </h2>
          <button
            type="button"
            className="standoff-download__close"
            aria-label={t.common.close}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="standoff-download__options">
          <a
            href={ANDROID_APK_STABLE_PATH}
            className="standoff-download__option standoff-download__option--android"
            download
            onClick={onClose}
          >
            <span className="standoff-download__option-label">{t.title.downloadAppAndroid}</span>
            <span className="standoff-download__option-sub">{t.title.downloadAppAndroidSub}</span>
          </a>

          <div
            className="standoff-download__option standoff-download__option--ios"
            aria-disabled="true"
          >
            <span className="standoff-download__option-label">{t.title.downloadAppIos}</span>
            <span className="standoff-download__option-soon">{t.title.downloadAppIosSoon}</span>
          </div>
        </div>

        <p className="standoff-download__note">{t.title.downloadAppInstallNote}</p>
      </div>
    </div>,
    document.body,
  );
}

type TriggerProps = {
  onOpen: () => void;
};

export function AppDownloadButton({ onOpen }: TriggerProps) {
  const { t } = useGameI18n();

  return (
    <button
      type="button"
      className="standoff__btn standoff__btn--gold"
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <Image
        src="/assets/icons/menu-download.svg"
        alt=""
        width={22}
        height={22}
        className="standoff__btn-icon"
        unoptimized
      />
      <span className="standoff__btn-label">
        <span>{t.title.downloadApp}</span>
        <span className="standoff__btn-sub">{t.title.downloadAppSub}</span>
      </span>
    </button>
  );
}
