"use client";

import { m, useReducedMotion } from "framer-motion";
import { ActionButton } from "@/components/ActionButton";
import { EasterEggOverlay } from "@/components/EasterEggOverlay";
import { FloatingParticles } from "@/components/FloatingParticles";
import { GoldCoin } from "@/components/GoldCoin";
import { SocialBar } from "@/components/SocialBar";
import { PROJECT } from "@/content/project";
import { useLocale } from "@/context/LocaleContext";
import { useMascotEasterEgg } from "@/hooks/useMascotEasterEgg";
import { GAME_HOME_URL } from "@/lib/androidDownload";
import { getLiveStatusState } from "@/lib/launch";
import { EASE } from "@/lib/motion";

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  const { t } = useLocale();
  const { active, handleMascotClick, fadeMs } = useMascotEasterEgg();
  const live = getLiveStatusState();

  return (
    <>
      <section
        aria-labelledby="hero-title"
        className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-16 text-center sm:pb-28 sm:pt-20"
      >
        <img
          src="/pixel/pasture-hero-bg.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{
            maskImage: "linear-gradient(to bottom, black 72%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 72%, transparent 100%)",
          }}
        />
        <div aria-hidden="true" className="gold-glow-bg pointer-events-none absolute inset-0" />
        <img
          src="/pixel/alpaca-sunglasses.png"
          alt=""
          aria-hidden="true"
          className="coin-float pointer-events-none absolute bottom-6 left-2 hidden w-20 sm:block sm:w-28 md:left-8 md:w-32"
        />
        <img
          src="/pixel/alpaca-goofy.png"
          alt=""
          aria-hidden="true"
          className="coin-float pointer-events-none absolute bottom-8 right-2 hidden w-20 sm:block sm:w-24 md:right-8 md:w-28"
          style={{ animationDelay: "1.5s" }}
        />
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
            className="mt-5 font-[family-name:var(--font-anton)] text-[clamp(1.75rem,7.5vw,4.25rem)] leading-[1.35] tracking-normal text-foreground drop-shadow-[3px_3px_0_rgba(255,255,255,0.6)] sm:mt-6"
          >
            {PROJECT.name}
          </h1>

          <div className="mt-3 space-y-0.5 sm:mt-4">
            <p className="font-[family-name:var(--font-anton)] text-[0.65rem] tracking-[0.32em] text-wood-dark drop-shadow-[1px_1px_0_rgba(255,255,255,0.7)] sm:text-xs">
              {t.hero.chain}
            </p>
            <p className="font-[family-name:var(--font-anton)] text-[0.6rem] tracking-[0.22em] text-wood-dark/80 drop-shadow-[1px_1px_0_rgba(255,255,255,0.7)] sm:text-[0.68rem]">
              {live.isLive ? t.liveStatus.statusLive : t.hero.chainStatus}
            </p>
          </div>

          <p className="hero-ticker mt-7 sm:mt-8">
            <span className="hero-ticker-label">{t.hero.tickerLabel}:</span>{" "}
            <span className="hero-ticker-value">{t.hero.ticker}</span>
          </p>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-wood-dark drop-shadow-[1px_1px_0_rgba(255,255,255,0.6)] sm:mt-6 sm:text-xl md:text-2xl">
            {t.hero.tagline}
          </p>

          <nav
            aria-label={t.a11y.primaryLinks}
            className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:mt-12"
          >
            <ActionButton href={GAME_HOME_URL} size="lg" variant="gold">
              {t.hero.playGame}
            </ActionButton>
            <ActionButton href="/download" size="lg" sublabel={t.hero.downloadAndroidSubtext}>
              {t.hero.downloadAndroidApp}
            </ActionButton>
            <ActionButton href="/litepaper" size="lg">
              {t.hero.readLitepaper}
            </ActionButton>
          </nav>

          <p className="mt-4 max-w-md text-xs leading-relaxed text-wood-dark/80 sm:text-sm">
            {t.hero.downloadAndroidInstallNote}
          </p>

          <SocialBar className="mt-10 sm:mt-11" />
        </m.div>
      </section>

      <EasterEggOverlay active={active} fadeMs={fadeMs} tagline={t.hero.tagline} />
    </>
  );
}
