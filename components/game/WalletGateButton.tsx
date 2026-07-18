"use client";

import { useRouter } from "next/navigation";
import { useState, type ComponentProps, type ReactNode } from "react";
import { PixelButton } from "@/components/ui/pixel";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import { WalletRequiredModal } from "./WalletRequiredModal";

type PixelButtonProps = ComponentProps<typeof PixelButton>;

type Props = Omit<PixelButtonProps, "href" | "disabled" | "onClick"> & {
  children: ReactNode;
  feature: string;
  href?: string;
  onReady?: () => void;
  className?: string;
};

/**
 * Runs href/onReady when mock wallet is connected; otherwise opens Wallet Required.
 */
export function WalletGateButton({
  children,
  feature,
  href,
  onReady,
  className = "",
  ...buttonProps
}: Props) {
  const { wallet, connectMock } = useWalletUi();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const proceed = () => {
    if (onReady) onReady();
    if (href) router.push(href);
  };

  return (
    <>
      <span className={`inline-flex w-full ${className}`}>
        <PixelButton
          {...buttonProps}
          className="w-full"
          onClick={() => {
            if (wallet.connected) proceed();
            else setOpen(true);
          }}
          aria-haspopup="dialog"
        >
          {children}
        </PixelButton>
      </span>
      <WalletRequiredModal
        open={open}
        onClose={() => setOpen(false)}
        onConnect={connectMock}
        feature={feature}
      />
    </>
  );
}
