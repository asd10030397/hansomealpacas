"use client";

import { m, useReducedMotion } from "framer-motion";
import { ActionButton } from "@/components/ActionButton";
import { EasterEggOverlay } from "@/components/EasterEggOverlay";
import { Mascot } from "@/components/Mascot";
import { PROJECT } from "@/content/project";
import { useKairuEasterEgg } from "@/hooks/useKairuEasterEgg";
import { getHeroActions } from "@/lib/launch";
import { EASE } from "@/lib/motion";

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  const { active, handleMascotClick, fadeMs } = useKairuEasterEgg();
  const actions = getHeroActions();

  const navItems = [
    actions.buy.show ? (
      <ActionButton key="buy" href={actions.buy.href} disabled={actions.buy.disabled}>
        BUY
      </ActionButton>
    ) : null,
    actions.chart.show ? (
      <ActionButton key="chart" href={actions.chart.href}>
        CHART
      </ActionButton>
    ) : null,
    actions.twitter.show ? (
      <ActionButton key="x" href={actions.twitter.href}>
        X
      </ActionButton>
    ) : null,
    actions.telegram.show ? (
      <ActionButton key="telegram" href={actions.telegram.href}>
        TELEGRAM
      </ActionButton>
    ) : null,
  ].filter(Boolean);

  return (
    <>
      <section
        aria-labelledby="hero-title"
        className="flex min-h-[100dvh] flex-col items-center justify-center px-6 pb-24 pt-16 text-center"
      >
        <m.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.8, ease: EASE }}
          className="flex flex-col items-center"
        >
          <Mascot
            floating={!reduceMotion}
            priority
            interactive
            onClick={handleMascotClick}
            alt={`${PROJECT.name} mascot`}
            className="mb-12 h-64 w-64 sm:mb-16 sm:h-72 sm:w-72 md:mb-20 md:h-80 md:w-80"
          />

          <h1
            id="hero-title"
            className="font-[family-name:var(--font-anton)] text-[clamp(3.5rem,12vw,9rem)] leading-none tracking-[0.06em] text-foreground"
          >
            {PROJECT.name}
          </h1>

          <p className="mt-5 text-base text-muted sm:mt-7 sm:text-xl md:text-2xl">
            {PROJECT.taglineCN}
          </p>

          {navItems.length > 0 && (
            <nav
              aria-label="Primary links"
              className="mt-14 flex flex-wrap items-center justify-center gap-3 sm:mt-16 sm:gap-4"
            >
              {navItems}
            </nav>
          )}
        </m.div>
      </section>

      <EasterEggOverlay active={active} fadeMs={fadeMs} />
    </>
  );
}
