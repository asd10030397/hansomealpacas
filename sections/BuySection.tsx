"use client";

import { m } from "framer-motion";
import { ActionButton } from "@/components/ActionButton";
import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";
import { getBuySectionState } from "@/lib/launch";

export function BuySection() {
  const { t } = useLocale();
  const buy = getBuySectionState();

  return (
    <FadeIn as="section" id="buy">
      <Section ariaLabelledBy="buy-title" className="flex flex-col items-center py-0 text-center">
        <div className="gold-border relative w-full max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-b from-gold/10 via-gold/5 to-transparent px-6 py-14 sm:px-10 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.18),transparent_55%)]"
          />

          <m.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative z-10 flex flex-col items-center"
          >
            <h2
              id="buy-title"
              className="font-[family-name:var(--font-anton)] text-[clamp(2.5rem,8vw,4.5rem)] tracking-[0.08em] text-foreground"
            >
              {t.buy.title}
            </h2>
            <p className="mt-5 max-w-xl text-base text-muted sm:text-xl">{t.buy.subtitle}</p>

            <div className="mt-10 flex flex-col items-center gap-4">
              <ActionButton
                href={buy.href}
                disabled={buy.comingSoon}
                variant="gold"
                size="lg"
                sublabel={buy.comingSoon ? t.buy.comingSoon : undefined}
              >
                {t.buy.cta}
              </ActionButton>
            </div>
          </m.div>
        </div>
      </Section>
    </FadeIn>
  );
}
