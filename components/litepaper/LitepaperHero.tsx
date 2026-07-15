"use client";

import Link from "next/link";
import { FadeIn } from "@/components/FadeIn";
import { useLocale } from "@/context/LocaleContext";
import { PDF_DOWNLOAD_PATHS } from "@/content/litepaper";

export function LitepaperHero() {
  const { t, locale } = useLocale();
  const hero = t.litepaper.hero;

  return (
    <FadeIn as="div" className="relative pb-16 pt-4 sm:pb-24">
      <img
        src="/pixel/alpaca-sunglasses.png"
        alt=""
        aria-hidden="true"
        className="no-print pointer-events-none absolute -right-2 -top-2 hidden h-20 w-20 select-none opacity-90 sm:block sm:h-24 sm:w-24"
      />

      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--lp-text-faint)] transition-colors hover:text-[color:var(--lp-text)]"
        >
          {t.litepaper.backHome}
        </Link>
        <a
          href={PDF_DOWNLOAD_PATHS[locale]}
          download
          className="pixel-btn inline-flex items-center gap-1.5 border border-wood bg-[color:var(--lp-surface)] px-3.5 py-1.5 font-[family-name:var(--font-anton)] text-[0.65rem] tracking-[0.1em] text-gold transition-colors"
        >
          {t.litepaper.downloadPdf} ↓
        </a>
      </div>

      <p className="lp-eyebrow-chip mt-10 px-3 py-1.5 font-[family-name:var(--font-anton)] text-[0.6rem] tracking-[0.2em]">
        {hero.eyebrow}
      </p>
      <h1 className="mt-5 font-[family-name:var(--font-anton)] text-[clamp(1.75rem,6vw,3.5rem)] leading-[1.25] tracking-tight text-[color:var(--lp-text)]">
        {hero.title}
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-[color:var(--lp-text-muted)] sm:text-xl">
        {hero.subtitle}
      </p>

      <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
        {hero.meta.map((item) => (
          <div key={item.label}>
            <div className="lp-divider mb-4 w-10" />
            <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--lp-text-faint)]">{item.label}</dt>
            <dd className="mt-1.5 text-sm font-semibold text-[color:var(--lp-text)]">{item.value}</dd>
          </div>
        ))}
      </dl>
    </FadeIn>
  );
}
