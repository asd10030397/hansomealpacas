"use client";

import { ActionButton } from "@/components/ActionButton";
import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";
import {
  DEXTOOLS_CHART_WIDGET_URL,
  DEXTOOLS_PAIR_EXPLORER_URL,
} from "@/lib/market/constants";

export function DexToolsChartSection() {
  const { t } = useLocale();

  return (
    <FadeIn as="section" id="chart">
      <Section ariaLabelledBy="chart-title" className="flex flex-col items-center py-0 text-center">
        <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold-light sm:text-sm">
          {t.chart.eyebrow}
        </p>
        <h2
          id="chart-title"
          className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(2.5rem,8vw,5rem)] tracking-[0.08em] text-foreground"
        >
          {t.chart.title}
        </h2>
        <p className="mt-6 max-w-2xl text-base text-muted sm:text-xl">{t.chart.subtitle}</p>

        <div className="gold-border mt-14 w-full max-w-5xl overflow-hidden rounded-3xl p-3 sm:mt-16 sm:p-5">
          <div className="overflow-hidden rounded-2xl bg-[#1F2937]">
            <iframe
              title={t.chart.iframeTitle}
              src={DEXTOOLS_CHART_WIDGET_URL}
              loading="lazy"
              className="block h-[480px] w-full border-0 sm:h-[625px]"
              allow="clipboard-write"
            />
          </div>
        </div>

        <div className="mt-8">
          <ActionButton href={DEXTOOLS_PAIR_EXPLORER_URL} variant="gold">
            {t.chart.viewOnDextools}
          </ActionButton>
        </div>
      </Section>
    </FadeIn>
  );
}
