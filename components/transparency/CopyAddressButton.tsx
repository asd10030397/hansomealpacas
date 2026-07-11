"use client";

import { useCallback, useState } from "react";

type CopyAddressButtonProps = {
  address: string;
  label?: string;
  copiedLabel?: string;
};

export function CopyAddressButton({
  address,
  label = "Copy Address",
  copiedLabel = "Copied",
}: CopyAddressButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [address]);

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="pixel-btn inline-flex items-center justify-center border-wood bg-gold/20 px-6 py-3 font-[family-name:var(--font-anton)] text-xs tracking-[0.16em] text-gold-light sm:text-sm"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
