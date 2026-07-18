"use client";

import type { ReactNode } from "react";
import { PixelButton } from "./PixelButton";

export function PixelModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="pixel-border w-full max-w-md bg-[#1e2433] p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="pixel-title text-xs">{title}</h2>
          <PixelButton size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            X
          </PixelButton>
        </div>
        {children}
      </div>
    </div>
  );
}
