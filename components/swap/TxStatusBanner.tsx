"use client";

import { m } from "framer-motion";
import { useLocale } from "@/context/LocaleContext";
import { getExplorerTxUrl } from "@/lib/chain";

export type TxPhase = "idle" | "loading" | "success" | "failed";

type TxStatusBannerProps = {
  phase: TxPhase;
  message?: string;
  txHash?: string;
};

export function TxStatusBanner({ phase, message, txHash }: TxStatusBannerProps) {
  const { t } = useLocale();

  if (phase === "idle") return null;

  const toneClass =
    phase === "loading"
      ? "border-gold/35 bg-gold/5 text-gold-light"
      : phase === "success"
        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
        : "border-red-500/35 bg-red-500/10 text-red-200";

  const label =
    phase === "loading"
      ? t.swap.status.loading
      : phase === "success"
        ? t.swap.status.success
        : t.swap.status.failed;

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${toneClass}`}
      role="status"
      aria-live="polite"
    >
      <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.18em]">{label}</p>
      {message ? <p className="mt-1 text-xs opacity-90">{message}</p> : null}
      {phase === "success" && txHash ? (
        <a
          href={getExplorerTxUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs underline underline-offset-2 opacity-90 hover:opacity-100"
        >
          {t.swap.viewTx}
        </a>
      ) : null}
    </m.div>
  );
}
