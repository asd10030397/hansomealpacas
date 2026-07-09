"use client";

import { useLocale } from "@/context/LocaleContext";
import type { Locale } from "@/content/i18n/types";

const toggleClass =
  "font-[family-name:var(--font-anton)] text-[0.65rem] tracking-[0.18em] transition-opacity sm:text-xs";

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  const setActive = (next: Locale) => {
    if (next !== locale) setLocale(next);
  };

  return (
    <nav
      aria-label={t.language.toggleLabel}
      className="fixed right-6 top-6 z-40 flex items-center gap-2 sm:right-8 sm:top-8"
    >
      <button
        type="button"
        onClick={() => setActive("zh")}
        className={`${toggleClass} ${locale === "zh" ? "text-foreground" : "text-muted hover:opacity-70"}`}
        aria-current={locale === "zh" ? "true" : undefined}
      >
        {t.language.zh}
      </button>
      <span aria-hidden="true" className="text-muted/40">
        |
      </span>
      <button
        type="button"
        onClick={() => setActive("en")}
        className={`${toggleClass} ${locale === "en" ? "text-foreground" : "text-muted hover:opacity-70"}`}
        aria-current={locale === "en" ? "true" : undefined}
      >
        {t.language.en}
      </button>
    </nav>
  );
}
