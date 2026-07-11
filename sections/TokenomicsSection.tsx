"use client";

import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";

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

        <div className="mt-14 grid w-full max-w-4xl grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {t.tokenomics.items.map((item) => (
            <div
              key={item.label}
              className="gold-border rounded-2xl bg-white/[0.02] px-6 py-8 backdrop-blur-sm sm:px-7 sm:py-9"
            >
              <p className="font-[family-name:var(--font-anton)] text-[0.65rem] tracking-[0.28em] text-gold sm:text-xs">
                {item.label}
              </p>
              <p className="mt-4 font-[family-name:var(--font-anton)] text-2xl tracking-[0.06em] text-foreground sm:text-3xl">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </FadeIn>
  );
}
