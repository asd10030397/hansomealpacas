"use client";

import { m } from "framer-motion";
import { useCallback, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { shortenContractAddress } from "@/lib/links";

type CopyButtonProps = {
  value: string | null;
  variant?: "default" | "gold";
  showAddress?: boolean;
};

export function CopyButton({ value, variant = "default", showAddress = true }: CopyButtonProps) {
  const { t } = useLocale();
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

  const variantClass =
    variant === "gold"
      ? "border-gold/35 bg-gold/5 text-gold-light hover:border-gold/55"
      : "border-border text-foreground";

  return (
    <m.button
      type="button"
      onClick={handleCopy}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { opacity: 0.85 }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center justify-center gap-3 border px-10 py-3.5 font-[family-name:var(--font-anton)] text-sm tracking-[0.2em] ${
        isDisabled ? "cursor-default text-muted" : `cursor-pointer ${variantClass}`
      }`}
      aria-label={
        isDisabled ? t.contract.comingSoon : copied ? t.a11y.copiedContract : t.a11y.copyContract
      }
    >
      {isDisabled ? (
        t.contract.comingSoon
      ) : copied ? (
        t.contract.copied
      ) : (
        <>
          {showAddress ? (
            <span className="font-[family-name:var(--font-body)] text-xs tracking-normal text-muted sm:text-sm">
              {shortenContractAddress(value)}
            </span>
          ) : null}
          <span>{t.contract.copy}</span>
        </>
      )}
    </m.button>
  );
}
