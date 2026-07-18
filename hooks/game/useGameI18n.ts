"use client";

import { useMemo } from "react";
import { getGameMessages } from "@/content/i18n/game";
import type { GameMessages } from "@/content/i18n/game/types";
import { useLocale } from "@/context/LocaleContext";
import type { Locale } from "@/content/i18n/types";

type GameI18n = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: GameMessages;
};

/**
 * Game UI translations. Shares locale + localStorage with the marketing site
 * via LocaleProvider so the preference carries across both surfaces.
 */
export function useGameI18n(): GameI18n {
  const { locale, setLocale } = useLocale();
  const t = useMemo(() => getGameMessages(locale), [locale]);
  return { locale, setLocale, t };
}
