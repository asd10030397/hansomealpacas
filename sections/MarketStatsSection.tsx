"use client";

import { FadeIn } from "@/components/FadeIn";
import { Sparkline } from "@/components/market/Sparkline";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";
import { useMarketStats } from "@/hooks/useMarketStats";
import { formatCompact, formatEth, formatPercentChange, formatUsd } from "@/lib/market/format";
import type { MarketStatsResponse, PriceChangeKey } from "@/lib/market/types";

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
            {isUp ? "Up" : isDown ? "Down" : "Flat"} {formatPercentChange(value)}
          </>
        )}
      </p>
    </div>
  );
}

function MarketStatsDashboard({
  data,
  changeLabels,
  historyBuilding,
}: {
  data: MarketStatsResponse;
  changeLabels: Record<PriceChangeKey, string>;
  historyBuilding?: string;
}) {
  const { t } = useLocale();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-left">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">{t.market.spotPrice}</p>
          <p className="mt-2 font-[family-name:var(--font-anton)] text-[clamp(1.75rem,5vw,2.75rem)] tracking-[0.08em] text-gold-light">
            {formatUsd(data.priceUsd)}
          </p>
          <p className="mt-1 text-sm tabular-nums text-muted">{formatEth(data.priceEth)}</p>
        </div>
        <p className="text-left text-xs text-muted sm:text-right">
          {t.market.liveRefresh}
          <br />
          <span className="tabular-nums text-foreground/80">
            {new Date(data.updatedAt).toLocaleTimeString()}
          </span>
        </p>
      </div>

      <Sparkline points={data.sparkline} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t.market.marketCap} value={formatUsd(data.marketCapUsd)} />
        <StatCard
          label={t.market.liquidity}
          value={`${formatCompact(data.liquidity.eth)} ETH`}
          subvalue={`${formatCompact(data.liquidity.ugly)} UGLY`}
        />
        <StatCard label={t.market.tvl} value={formatUsd(data.tvlUsd)} />
        <StatCard
          label={t.market.priceEth}
          value={formatEth(data.priceEth)}
          subvalue={`1 ETH = ${formatCompact(data.uglyPerEth)} UGLY`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(Object.keys(changeLabels) as PriceChangeKey[]).map((key) => (
          <ChangeBadge key={key} label={changeLabels[key]} value={data.changes[key]} />
        ))}
      </div>

      {historyBuilding ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{historyBuilding}</p>
      ) : null}
    </div>
  );
}

export function MarketStatsSection() {
  const { t } = useLocale();
  const { data } = useMarketStats();

  const changeLabels: Record<PriceChangeKey, string> = {
    h1: t.market.change1h,
    h24: t.market.change24h,
    d7: t.market.change7d,
  };

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
          {!data ? (
            <p className="py-10 text-sm text-muted">{t.market.loading}</p>
          ) : (
            <MarketStatsDashboard
              data={data}
              changeLabels={changeLabels}
              historyBuilding={data.historyStatus === "building" ? t.market.historyBuilding : undefined}
            />
          )}
        </div>
      </Section>
    </FadeIn>
  );
}
