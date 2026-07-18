import { gameEn } from "@/content/i18n/game/en";
import { gameZh } from "@/content/i18n/game/zh";
import type { GameMessages } from "@/content/i18n/game/types";
import type { Locale } from "@/content/i18n/types";

export type { GameMessages } from "@/content/i18n/game/types";

const catalogs: Record<Locale, GameMessages> = {
  en: gameEn,
  zh: gameZh,
};

/** Resolve game UI strings for a locale. Fall back to English for missing keys later if needed. */
export function getGameMessages(locale: Locale): GameMessages {
  return catalogs[locale] ?? gameEn;
}

export const GAME_LOCALES: Locale[] = ["en", "zh"];
