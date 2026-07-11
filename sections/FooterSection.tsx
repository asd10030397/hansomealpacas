"use client";

import { FadeIn } from "@/components/FadeIn";
import { SocialBar } from "@/components/SocialBar";
import { PROJECT } from "@/content/project";
import { useLocale } from "@/context/LocaleContext";

export function FooterSection() {
  const { t } = useLocale();

  return (
    <footer className="relative border-t border-border/80 px-6 pb-16 pt-24 sm:pb-20 sm:pt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
      />
      <FadeIn className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <p className="font-[family-name:var(--font-anton)] text-3xl tracking-[0.08em] text-foreground sm:text-4xl">
          {PROJECT.name}
        </p>

        <p className="mt-4 text-base text-muted sm:text-lg">{t.footer.tagline}</p>

        <SocialBar className="mt-10" size="sm" />

        <p className="mt-14 max-w-3xl text-[0.6875rem] leading-relaxed tracking-wide text-muted/70 sm:text-xs">
          {t.footer.disclaimer}
        </p>

        <p className="mt-8 text-xs tracking-wide text-muted/50">{t.footer.copyright}</p>
      </FadeIn>
    </footer>
  );
}
