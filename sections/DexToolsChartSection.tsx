"use client";

import { ActionButton } from "@/components/ActionButton";
import { useLocale } from "@/context/LocaleContext";
import {
  DEXTOOLS_CHART_WIDGET_URL,
  DEXTOOLS_PAIR_EXPLORER_URL,
} from "@/lib/market/constants";

export function DexToolsChartSection() {
  const { t } = useLocale();

  return (
    <section id="chart" aria-labelledby="chart-title" className="bg-sky">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-10 text-center sm:py-14">
        <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold-light sm:text-sm">
          {t.chart.eyebrow}
        </p>
        <h2
          id="chart-title"
          className="mt-3 font-[family-name:var(--font-anton)] text-[clamp(1.75rem,6vw,3.5rem)] tracking-[0.08em] text-foreground sm:mt-4"
        >
          {t.chart.title}
        </h2>
        <p className="mt-4 max-w-2xl text-base text-muted sm:mt-5 sm:text-lg">{t.chart.subtitle}</p>

        <div className="gold-border mt-8 w-full max-w-5xl overflow-hidden rounded-3xl p-2 sm:mt-10 sm:p-4">
          <div className="relative w-full overflow-hidden rounded-2xl bg-[#1F2937] pt-[72%] sm:pt-[58%]">
            <iframe
              title={t.chart.iframeTitle}
              src={DEXTOOLS_CHART_WIDGET_URL}
              loading="eager"
              referrerPolicy="origin-when-cross-origin"
              className="absolute inset-0 block h-full w-full border-0"
              allow="clipboard-write"
            />
          </div>
        </div>

        <div className="mt-6 sm:mt-8">
          <ActionButton href={DEXTOOLS_PAIR_EXPLORER_URL} variant="gold">
            {t.chart.viewOnDextools}
          </ActionButton>
        </div>
      </div>
    </section>
  );
}
