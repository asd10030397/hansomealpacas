"use client";

import { CopyButton } from "@/components/CopyButton";
import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";
import { getContractState } from "@/lib/launch";

export function ContractSection() {
  const { t } = useLocale();
  const contract = getContractState();

  return (
    <FadeIn as="section" id="contract">
      <Section ariaLabelledBy="contract-title" className="flex flex-col items-center py-0 text-center">
        <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold sm:text-sm">
          {t.contract.eyebrow}
        </p>
        <h2
          id="contract-title"
          className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(2.5rem,8vw,5rem)] tracking-[0.08em] text-foreground"
        >
          {t.contract.title}
        </h2>
        <p className="mt-6 max-w-2xl text-base text-muted sm:text-xl">{t.contract.subtitle}</p>

        <div className="gold-border mt-14 w-full max-w-3xl rounded-2xl bg-white/[0.02] px-6 py-10 sm:mt-16 sm:px-10 sm:py-12">
          <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.28em] text-gold">
            {t.contract.addressLabel}
          </p>

          <div className="mt-6 flex flex-col items-center gap-8">
            <div className="w-full overflow-hidden rounded-xl border border-border bg-background/80 px-4 py-6 sm:px-6">
              <p
                className={`font-[family-name:var(--font-anton)] text-lg tracking-[0.2em] sm:text-xl ${
                  contract.address ? "font-mono text-sm tracking-wide text-foreground" : "text-gold-light"
                }`}
                aria-live="polite"
              >
                {contract.address ?? t.contract.placeholder}
              </p>
            </div>

            <CopyButton value={contract.address} variant="gold" />
          </div>
        </div>
      </Section>
    </FadeIn>
  );
}
