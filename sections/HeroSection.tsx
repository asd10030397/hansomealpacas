"use client";

import { m, useReducedMotion } from "framer-motion";
import { ActionButton } from "@/components/ActionButton";
import { EasterEggOverlay } from "@/components/EasterEggOverlay";
import { FloatingParticles } from "@/components/FloatingParticles";
import { GoldCoin } from "@/components/GoldCoin";
import { SocialBar } from "@/components/SocialBar";
import { PROJECT } from "@/content/project";
import { useLocale } from "@/context/LocaleContext";
import { useUglyDeerEasterEgg } from "@/hooks/useUglyDeerEasterEgg";
import { getBuySectionState, getHeroActions } from "@/lib/launch";
import { EASE } from "@/lib/motion";

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  const { t } = useLocale();
  const { active, handleMascotClick, fadeMs } = useUglyDeerEasterEgg();
  const actions = getHeroActions();
  const buy = getBuySectionState();

  const navItems = [
    buy.comingSoon || buy.href ? (
      <ActionButton
        key="buy"
        href={buy.href}
        disabled={buy.comingSoon}
        variant="gold"
      >
        {t.buy.cta}
      </ActionButton>
    ) : null,
    actions.chart.show ? (
      <ActionButton key="chart" href={actions.chart.href}>
        {t.hero.chart}
      </ActionButton>
    ) : null,
  ].filter(Boolean);

  return (
    <>
      <section
        aria-labelledby="hero-title"
        className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-20 text-center sm:pb-28 sm:pt-24"
      >
        <div aria-hidden="true" className="gold-glow-bg pointer-events-none absolute inset-0" />
        <FloatingParticles />

        <m.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: EASE }}
          className="relative z-10 flex w-full max-w-6xl flex-col items-center"
        >
          <GoldCoin interactive onClick={handleMascotClick} className="mb-6 sm:mb-10" />

          <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.45em] text-gold sm:text-sm">
            {t.hero.eyebrow}
          </p>

          <h1
            id="hero-title"
            className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(3.75rem,14vw,10rem)] leading-[0.92] tracking-[0.04em] text-foreground sm:mt-5"
          >
            {PROJECT.name}
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted sm:mt-8 sm:text-2xl md:text-3xl">
            {t.hero.tagline}
          </p>

          <SocialBar className="mt-10 sm:mt-12" />

          {navItems.length > 0 && (
            <nav
              aria-label={t.a11y.primaryLinks}
              className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:mt-12 sm:gap-4"
            >
              {navItems}
            </nav>
          )}
        </m.div>
      </section>

      <EasterEggOverlay active={active} fadeMs={fadeMs} tagline={t.hero.tagline} />
    </>
  );
}
