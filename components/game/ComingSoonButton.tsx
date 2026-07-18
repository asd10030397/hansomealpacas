"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { PixelBadge, PixelButton } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { ComingSoonModal } from "./ComingSoonModal";

type PixelButtonProps = ComponentProps<typeof PixelButton>;

type Props = Omit<PixelButtonProps, "href" | "disabled" | "onClick"> & {
  children: ReactNode;
  /** Shown as chip inside the modal */
  feature: string;
  /** Hide the small badge (default: show) */
  showBadge?: boolean;
};

/**
 * Button that opens ComingSoonModal instead of a real action.
 * Swap for a real handler/href when the feature is implemented.
 */
export function ComingSoonButton({
  children,
  feature,
  showBadge = true,
  className = "",
  ...buttonProps
}: Props) {
  const { t } = useGameI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <span className={`relative inline-flex w-full flex-col items-stretch ${className}`}>
        {showBadge ? (
          <span className="pointer-events-none absolute -right-1 -top-2 z-10">
            <PixelBadge tone="gold">{t.common.soonBadge}</PixelBadge>
          </span>
        ) : null}
        <PixelButton
          {...buttonProps}
          className="w-full"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          {children}
        </PixelButton>
      </span>
      <ComingSoonModal open={open} onClose={() => setOpen(false)} feature={feature} />
    </>
  );
}
