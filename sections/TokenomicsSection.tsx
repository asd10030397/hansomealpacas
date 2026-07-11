"use client";

import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";
import type { TokenomicsItem } from "@/content/i18n/types";

const labelClassName =
  "text-xs font-medium uppercase tracking-[0.28em] text-gold/70 sm:text-sm sm:tracking-[0.32em]";

function NetworkTokenomicsCard({ item }: { item: TokenomicsItem }) {
  return (
    <div className="tokenomics-card flex h-full min-h-[12rem] min-w-0 flex-col items-center justify-center rounded-2xl px-4 py-11 font-[family-name:var(--font-noto-sans-tc)] sm:min-h-[13rem] sm:px-5 sm:py-12">
      <p className={labelClassName}>{item.label}</p>

      <div className="mt-8 flex w-full min-w-0 flex-col items-center sm:mt-9">
        {item.valueLines?.map((line) => (
          <p
            key={line}
            className="w-full whitespace-nowrap text-center text-xl font-medium leading-[1.1] tracking-[-0.01em] text-foreground md:text-2xl lg:text-3xl xl:text-2xl"
          >
            {line}
          </p>
        ))}
      </div>

      {item.badge ? (
        <span className="mt-8 inline-flex h-[36px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-gold/75 px-5 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-background/90 sm:mt-9 sm:px-6">
          {item.badge}
        </span>
      ) : null}
    </div>
  );
}

function TokenomicsCard({ item }: { item: TokenomicsItem }) {
  if (item.variant === "network") {
    return <NetworkTokenomicsCard item={item} />;
  }

  return (
    <div className="tokenomics-card flex h-full min-h-[12rem] flex-col items-center justify-center rounded-2xl px-5 py-11 font-[family-name:var(--font-noto-sans-tc)] sm:min-h-[13rem] sm:px-6 sm:py-12">
      <p className={labelClassName}>{item.label}</p>

      {item.valueLines ? (
        <div className="mt-8 flex w-full flex-col items-center gap-1 sm:mt-9">
          {item.valueLines.map((line) => (
            <p
              key={line}
              className="w-full whitespace-nowrap text-center text-[clamp(1.75rem,3.2vw,2.25rem)] font-medium leading-[1.05] tracking-[-0.02em] text-foreground"
            >
              {line}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-8 whitespace-nowrap text-[clamp(2.625rem,5vw,3.5rem)] font-medium tabular-nums leading-none tracking-[-0.03em] text-foreground sm:mt-9">
          {item.value}
        </p>
      )}

      {item.secondary ? (
        <p className="mt-4 text-sm tabular-nums leading-snug text-muted sm:mt-5 sm:text-base">
          {item.secondary}
        </p>
      ) : null}

      {item.badge ? (
        <span className="mt-5 rounded-full bg-gold/75 px-2.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.14em] text-background/90 sm:mt-6 sm:px-3 sm:text-[0.6875rem]">
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
          <p className="font-[family-name:var(--font-anton)] text-[0.65rem] tracking-[0.32em] text-gold/70 sm:text-xs">
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
