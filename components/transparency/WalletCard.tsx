"use client";

import { useCallback, useState } from "react";
import type { OfficialWallet } from "@/content/transparency";
import { useLocale } from "@/context/LocaleContext";

type WalletCardProps = {
  wallet: OfficialWallet;
};

export function WalletCard({ wallet }: WalletCardProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [wallet.address]);

  return (
    <article className="gold-border rounded-2xl bg-white/[0.02] p-6 text-left sm:p-8">
      <header>
        <h2 className="font-[family-name:var(--font-anton)] text-xl tracking-[0.1em] text-foreground sm:text-2xl">
          <span aria-hidden="true" className="mr-2">
            {wallet.emoji}
          </span>
          {wallet.title}
        </h2>
      </header>

      <dl className="mt-6 space-y-4 text-sm sm:text-base">
        <div>
          <dt className="text-xs uppercase tracking-[0.22em] text-gold/70">{t.transparency.purpose}</dt>
          <dd className="mt-1.5 text-muted">{wallet.purpose}</dd>
        </div>

        {wallet.liquidityDetail ? (
          <div>
            <dt className="text-xs uppercase tracking-[0.22em] text-gold/70">
              {t.transparency.liquidityPosition}
            </dt>
            <dd className="mt-1.5 text-muted">{wallet.liquidityDetail}</dd>
          </div>
        ) : null}

        <div>
          <dt className="text-xs uppercase tracking-[0.22em] text-gold/70">{t.transparency.allocation}</dt>
          <dd className="mt-1.5 font-medium tabular-nums text-foreground">{wallet.allocation}</dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-[0.22em] text-gold/70">{t.transparency.address}</dt>
          <dd className="mt-1.5 break-all font-mono text-xs text-foreground/90 sm:text-sm">{wallet.address}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center justify-center border border-gold/35 bg-gold/5 px-6 py-3 font-[family-name:var(--font-anton)] text-xs tracking-[0.16em] text-gold-light transition-all hover:border-gold/55 sm:text-sm"
        >
          {copied ? t.transparency.copied : t.transparency.copyAddress}
        </button>
        <a
          href={wallet.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center border border-border px-6 py-3 font-[family-name:var(--font-anton)] text-xs tracking-[0.16em] text-foreground transition-all hover:border-gold/35 sm:text-sm"
        >
          {t.transparency.viewBlockscout}
        </a>
      </div>

      {wallet.note ? (
        <p className="mt-5 border-t border-border/60 pt-5 text-xs leading-relaxed text-muted sm:text-sm">
          {wallet.note}
        </p>
      ) : null}
    </article>
  );
}
