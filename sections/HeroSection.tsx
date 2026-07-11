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

  return (
    <>
      <section
        aria-labelledby="hero-title"
        className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-16 text-center sm:pb-28 sm:pt-20"
      >
        <div aria-hidden="true" className="gold-glow-bg pointer-events-none absolute inset-0" />
        <FloatingParticles />

        <m.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.75, ease: EASE }}
          className="relative z-10 flex w-full max-w-6xl flex-col items-center"
        >
          <GoldCoin interactive onClick={handleMascotClick} className="mb-8 sm:mb-12" />

          <p className="meme-badge" aria-label={t.hero.memeBadge}>
            <span aria-hidden="true" className="meme-badge-spark left">
              ✦
            </span>
            {t.hero.memeBadge}
            <span aria-hidden="true" className="meme-badge-spark right">
              ✦
            </span>
          </p>

          <h1
            id="hero-title"
            className="mt-5 font-[family-name:var(--font-anton)] text-[clamp(3.5rem,13vw,9rem)] leading-[0.92] tracking-[0.04em] text-foreground sm:mt-6"
          >
            {PROJECT.name}
          </h1>

          <div className="mt-3 space-y-0.5 sm:mt-4">
            <p className="font-[family-name:var(--font-anton)] text-[0.65rem] tracking-[0.32em] text-muted/80 sm:text-xs">
              {t.hero.chain}
            </p>
            <p className="font-[family-name:var(--font-anton)] text-[0.6rem] tracking-[0.22em] text-muted/55 sm:text-[0.68rem]">
              {t.hero.chainStatus}
            </p>
          </div>

          <p className="hero-ticker mt-7 sm:mt-8">
            <span className="hero-ticker-label">{t.hero.tickerLabel}:</span>{" "}
            <span className="hero-ticker-value">{t.hero.ticker}</span>
          </p>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted sm:mt-6 sm:text-xl md:text-2xl">
            {t.hero.tagline}
          </p>

          <nav
            aria-label={t.a11y.primaryLinks}
            className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:mt-12 sm:gap-4"
          >
            <ActionButton
              href={buy.href}
              disabled={buy.comingSoon}
              variant="gold"
              size="lg"
              sublabel={buy.comingSoon ? t.buy.comingSoon : undefined}
            >
              {t.buy.cta}
            </ActionButton>
            <ActionButton href={actions.twitter.href} size="lg">
              {t.hero.followX}
            </ActionButton>
          </nav>

          <SocialBar className="mt-10 sm:mt-11" />
        </m.div>
      </section>

      <EasterEggOverlay active={active} fadeMs={fadeMs} tagline={t.hero.tagline} />
    </>
  );
}
