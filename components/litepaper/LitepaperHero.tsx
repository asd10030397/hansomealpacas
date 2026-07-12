"use client";

import Link from "next/link";
import { FadeIn } from "@/components/FadeIn";
import { useLocale } from "@/context/LocaleContext";
import { PDF_DOWNLOAD_PATHS } from "@/content/litepaper";

export function LitepaperHero() {
  const { t, locale } = useLocale();
  const hero = t.litepaper.hero;

  return (
    <FadeIn as="div" className="pb-16 pt-4 sm:pb-24">
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/70">
          {t.litepaper.backHome}
        </Link>
        <a
          href={PDF_DOWNLOAD_PATHS[locale]}
          download
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
        >
          {t.litepaper.downloadPdf} ↓
        </a>
      </div>

      <p className="mt-10 text-xs font-medium uppercase tracking-[0.28em] text-white/40">{hero.eyebrow}</p>
      <h1 className="mt-4 text-[clamp(2.5rem,8vw,5rem)] font-semibold leading-[1.02] tracking-tight text-white">
        {hero.title}
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/55 sm:text-xl">{hero.subtitle}</p>

      <dl className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {hero.meta.map((item) => (
          <div key={item.label} className="border-t border-white/10 pt-4">
            <dt className="text-xs uppercase tracking-[0.14em] text-white/35">{item.label}</dt>
            <dd className="mt-1.5 text-sm font-medium text-white">{item.value}</dd>
          </div>
        ))}
      </dl>
    </FadeIn>
  );
}
