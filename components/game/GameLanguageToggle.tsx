"use client";

import { useGameI18n } from "@/hooks/game/useGameI18n";
import type { Locale } from "@/content/i18n/types";

/**
 * Pixel-styled EN / 中文 toggle for the game shell only.
 * Does not reuse marketing LanguageToggle markup or classes.
 */
export function GameLanguageToggle() {
  const { locale, setLocale, t } = useGameI18n();

  const setActive = (next: Locale) => {
    if (next !== locale) setLocale(next);
  };

  return (
    <nav className="game-lang" aria-label={t.language.toggleLabel} data-game-language-toggle="true">
      <div className="game-lang__group" role="group" aria-label={t.language.toggleLabel}>
        <button
          type="button"
          className={`game-lang__btn ${locale === "en" ? "game-lang__btn--active" : ""}`}
          onClick={() => setActive("en")}
          aria-current={locale === "en" ? "true" : undefined}
          aria-label={t.language.en}
        >
          {t.language.en}
        </button>
        <button
          type="button"
          className={`game-lang__btn ${locale === "zh" ? "game-lang__btn--active" : ""}`}
          onClick={() => setActive("zh")}
          aria-current={locale === "zh" ? "true" : undefined}
          aria-label={t.language.zh}
        >
          {t.language.zh}
        </button>
      </div>
    </nav>
  );
}
