"use client";

import { m } from "framer-motion";
import { useCallback, useState } from "react";
import { shortenContractAddress } from "@/lib/links";

type CopyButtonProps = {
  value: string | null;
  disabledLabel?: string;
};

export function CopyButton({
  value,
  disabledLabel = "Coming Soon",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const isDisabled = !value;

  const handleCopy = useCallback(async () => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <m.button
      type="button"
      onClick={handleCopy}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { opacity: 0.7 }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center justify-center gap-3 border px-10 py-3.5 font-[family-name:var(--font-anton)] text-sm tracking-[0.2em] ${
        isDisabled
          ? "cursor-default border-border text-muted"
          : "cursor-pointer border-border text-foreground"
      }`}
      aria-label={isDisabled ? disabledLabel : copied ? "Copied" : "Copy contract address"}
    >
      {isDisabled ? (
        disabledLabel
      ) : copied ? (
        "COPIED"
      ) : (
        <>
          <span className="font-[family-name:var(--font-body)] text-xs tracking-normal text-muted sm:text-sm">
            {shortenContractAddress(value)}
          </span>
          <span>COPY</span>
        </>
      )}
    </m.button>
  );
}
