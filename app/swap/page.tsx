"use client";

import Link from "next/link";
import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { SwapCard } from "@/components/swap/SwapCard";
import { useLocale } from "@/context/LocaleContext";

export default function SwapPage() {
  const { t } = useLocale();

  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden px-6 pb-20 pt-20 sm:pt-16">
      <div aria-hidden="true" className="gold-glow-bg pointer-events-none absolute inset-0" />

      <FadeIn as="div" className="relative z-10">
        <Section ariaLabelledBy="swap-page-title" className="flex flex-col items-center py-0">
          <Link
            href="/"
            className="mb-8 font-[family-name:var(--font-anton)] text-xs tracking-[0.28em] text-muted transition-colors hover:text-gold-light"
          >
            ← {t.swap.backHome}
          </Link>

          <SwapCard />
        </Section>
      </FadeIn>
    </main>
  );
}
