"use client";

import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";
import { useMarketStats } from "@/hooks/useMarketStats";
import { formatPercentChange, formatUsd } from "@/lib/market/format";
import type { MarketStatsResponse } from "@/lib/market/types";

function StatCard({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return (
    <div className="tokenomics-card flex min-h-[7.5rem] flex-col items-center justify-center rounded-2xl px-4 py-7 sm:min-h-[8rem] sm:px-5 sm:py-8">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-gold/70 sm:text-sm">{label}</p>
      <p className="mt-4 text-xl font-medium tabular-nums text-foreground sm:mt-5 sm:text-2xl">{value}</p>
      {subvalue ? <p className="mt-1 text-xs tabular-nums text-muted">{subvalue}</p> : null}
    </div>
  );
}

function ChangeBadge({ label, value }: { label: string; value: number | null }) {
  const isUp = value !== null && value > 0;
  const isDown = value !== null && value < 0;
  const toneClass = isUp
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : isDown
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : "border-border bg-white/[0.02] text-muted";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[0.65rem] uppercase tracking-[0.22em] opacity-80">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-anton)] text-sm tracking-[0.12em]">
        {value === null ? (
          "—"
        ) : (
          <>
            <span aria-hidden="true">{isUp ? "🟢 " : isDown ? "🔴 " : ""}</span>
            {formatPercentChange(value)}
          </>
        )}
      </p>
    </div>
  );
}

function formatTransactions(data: MarketStatsResponse, t: { market: { txBuys: string; txSells: string } }) {
  const tx = data.transactions24h;
  if (!tx) return "—";

  const buys = tx.buys ?? 0;
  const sells = tx.sells ?? 0;

  if (buys === 0 && sells === 0) return "0";

  return `${buys} ${t.market.txBuys} / ${sells} ${t.market.txSells}`;
}

function MarketStatsDashboard({ data }: { data: MarketStatsResponse }) {
  const { t } = useLocale();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-left">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">{t.market.uglyPrice}</p>
          <p className="mt-2 font-[family-name:var(--font-anton)] text-[clamp(1.75rem,5vw,2.75rem)] tracking-[0.08em] text-gold-light">
            {formatUsd(data.priceUsd)}
          </p>
          <p className="mt-1 text-sm tabular-nums text-muted">
            {data.priceEth > 0 ? `${data.priceEth.toFixed(10)} ETH` : "—"}
          </p>
        </div>
        <p className="text-left text-xs text-muted sm:text-right">
          {t.market.liveRefresh}
          <br />
          <span className="text-foreground/80">{data.poolName}</span>
          <br />
          <span className="tabular-nums text-foreground/80">
            {new Date(data.updatedAt).toLocaleTimeString()}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ChangeBadge label={t.market.change24h} value={data.change24h} />
        <StatCard label={t.market.volume24h} value={formatUsd(data.volume24hUsd)} />
        <StatCard label={t.market.liquidity} value={formatUsd(data.liquidityUsd)} />
        <StatCard label={t.market.transactions24h} value={formatTransactions(data, t)} />
      </div>
    </div>
  );
}

export function MarketStatsSection() {
  const { t } = useLocale();
  const { data, isLoading, hasError } = useMarketStats();

  return (
    <FadeIn as="section" id="market">
      <Section ariaLabelledBy="market-title" className="flex flex-col items-center py-0 text-center">
        <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold sm:text-sm">
          {t.market.eyebrow}
        </p>
        <h2
          id="market-title"
          className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(2.5rem,8vw,5rem)] tracking-[0.08em] text-foreground"
        >
          {t.market.title}
        </h2>
        <p className="mt-6 max-w-2xl text-base text-muted sm:text-xl">{t.market.subtitle}</p>

        <div className="gold-border mt-14 w-full max-w-5xl rounded-3xl bg-white/[0.02] p-6 sm:mt-16 sm:p-8">
          {isLoading && !data ? (
            <p className="py-10 text-sm text-muted">{t.market.loading}</p>
          ) : hasError && !data ? (
            <p className="py-10 text-sm text-muted">{t.market.unavailable}</p>
          ) : data ? (
            <MarketStatsDashboard data={data} />
          ) : null}
        </div>
      </Section>
    </FadeIn>
  );
}
