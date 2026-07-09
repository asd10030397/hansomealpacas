"use client";

import { useLocale } from "@/context/LocaleContext";
import type { Locale } from "@/content/i18n/types";

const segmentBase =
  "inline-flex min-h-11 min-w-[4.5rem] items-center justify-center px-6 font-[family-name:var(--font-anton)] text-sm tracking-[0.12em] transition-[opacity,border-color,background-color] duration-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-foreground sm:min-w-[5rem] sm:px-8 sm:text-base";

function segmentClass(active: boolean) {
  if (active) {
    return `${segmentBase} border border-foreground bg-foreground/[0.08] text-foreground`;
  }

  return `${segmentBase} border border-transparent bg-transparent text-muted hover:border-border hover:opacity-80`;
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  const setActive = (next: Locale) => {
    if (next !== locale) setLocale(next);
  };

  return (
    <nav
      aria-label={t.language.toggleLabel}
      className="fixed right-6 top-6 z-40 sm:right-8 sm:top-8"
    >
      <div
        role="group"
        aria-label={t.language.toggleLabel}
        className="inline-flex items-stretch border border-border"
      >
        <button
          type="button"
          onClick={() => setActive("zh")}
          className={segmentClass(locale === "zh")}
          aria-current={locale === "zh" ? "true" : undefined}
          aria-label={t.language.zh}
        >
          {t.language.zh}
        </button>

        <span aria-hidden="true" className="w-px self-stretch bg-border" />

        <button
          type="button"
          onClick={() => setActive("en")}
          className={segmentClass(locale === "en")}
          aria-current={locale === "en" ? "true" : undefined}
          aria-label={t.language.en}
        >
          {t.language.en}
        </button>
      </div>
    </nav>
  );
}
