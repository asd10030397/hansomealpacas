"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import type { Locale } from "@/content/i18n/types";
import { shouldHideMarketingLanguageToggle } from "@/lib/game/isGameChrome";

const segmentBase =
  "inline-flex min-h-10 min-w-[3.25rem] items-center justify-center px-3 font-[family-name:var(--font-anton)] text-xs tracking-[0.12em] transition-[opacity,border-color,background-color] duration-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-foreground sm:min-h-11 sm:min-w-[5rem] sm:px-8 sm:text-base";

function segmentClass(active: boolean) {
  if (active) {
    return `${segmentBase} border border-wood bg-gold/30 text-wood-dark`;
  }

  return `${segmentBase} border border-transparent bg-transparent text-muted hover:opacity-80`;
}

/**
 * Marketing-site language toggle only.
 * Never renders on /game/* or the dedicated game host — game uses GameLanguageToggle.
 */
export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();
  const pathname = usePathname();
  const [printMode, setPrintMode] = useState(false);
  const [hostname, setHostname] = useState<string | undefined>(undefined);

  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("print");
    const handleChange = () => setPrintMode(query.matches);
    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const setActive = (next: Locale) => {
    if (next !== locale) setLocale(next);
  };

  if (printMode) return null;
  if (shouldHideMarketingLanguageToggle(pathname, hostname)) return null;

  return (
    <nav
      aria-label={t.language.toggleLabel}
      data-language-toggle="true"
      data-marketing-language-toggle="true"
      className="no-print fixed right-3 top-3 z-40 sm:right-8 sm:top-8"
    >
      <div
        role="group"
        aria-label={t.language.toggleLabel}
        className="pixel-btn inline-flex items-stretch border-wood bg-surface"
      >
        <button
          type="button"
          onClick={() => setActive("en")}
          className={segmentClass(locale === "en")}
          aria-current={locale === "en" ? "true" : undefined}
          aria-label={t.language.en}
        >
          {t.language.en}
        </button>

        <span aria-hidden="true" className="w-px self-stretch bg-border" />

        <button
          type="button"
          onClick={() => setActive("zh")}
          className={segmentClass(locale === "zh")}
          aria-current={locale === "zh" ? "true" : undefined}
          aria-label={t.language.zh}
        >
          {t.language.zh}
        </button>
      </div>
    </nav>
  );
}
