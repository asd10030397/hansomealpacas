"use client";

import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";
import type { TokenomicsItem } from "@/content/i18n/types";

function TokenomicsCard({ item }: { item: TokenomicsItem }) {
  return (
    <div className="gold-border flex h-full min-h-[11.5rem] flex-col items-center justify-center rounded-2xl bg-white/[0.02] px-5 py-10 font-[family-name:var(--font-noto-sans-tc)] backdrop-blur-sm sm:min-h-[12.5rem] sm:px-6 sm:py-11">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold sm:text-sm sm:tracking-[0.26em]">
        {item.label}
      </p>

      {item.valueLines ? (
        <div className="mt-6 flex flex-col items-center gap-0.5 sm:mt-7">
          {item.valueLines.map((line) => (
            <p
              key={line}
              className="whitespace-nowrap text-[clamp(1.75rem,3.2vw,2.25rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-foreground"
            >
              {line}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-6 whitespace-nowrap text-[clamp(2.625rem,5vw,3.5rem)] font-semibold leading-none tracking-[-0.03em] text-foreground sm:mt-7">
          {item.value}
        </p>
      )}

      {item.secondary ? (
        <p className="mt-2.5 text-sm leading-snug text-muted sm:mt-3 sm:text-base">{item.secondary}</p>
      ) : null}

      {item.badge ? (
        <span className="mt-4 rounded-full bg-gold px-3.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-background sm:mt-5 sm:px-4 sm:text-xs">
          {item.badge}
        </span>
      ) : null}
    </div>
  );
}

export function TokenomicsSection() {
  const { t } = useLocale();

  return (
    <FadeIn as="section" id="tokenomics">
      <Section ariaLabelledBy="tokenomics-title" className="flex flex-col items-center py-0 text-center">
        <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold sm:text-sm">
          {t.tokenomics.eyebrow}
        </p>
        <h2
          id="tokenomics-title"
          className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(2.5rem,8vw,5rem)] tracking-[0.08em] text-foreground"
        >
          {t.tokenomics.title}
        </h2>
        <p className="mt-6 max-w-2xl text-base text-muted sm:text-xl">{t.tokenomics.subtitle}</p>

        <div className="mt-8 flex flex-col items-center gap-1 sm:mt-10">
          <p className="font-[family-name:var(--font-anton)] text-[0.65rem] tracking-[0.32em] text-gold/80 sm:text-xs">
            {t.tokenomics.tickerLabel}
          </p>
          <p className="font-[family-name:var(--font-anton)] text-4xl tracking-[0.08em] text-gold-light sm:text-5xl">
            {t.tokenomics.ticker}
          </p>
        </div>

        <div className="mt-14 grid w-full max-w-5xl grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-5">
          {t.tokenomics.items.map((item) => (
            <TokenomicsCard key={item.label} item={item} />
          ))}
        </div>
      </Section>
    </FadeIn>
  );
}
