import { en } from "@/content/i18n/en";
import type { Locale, Messages } from "@/content/i18n/types";
import { zh } from "@/content/i18n/zh";

export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_STORAGE_KEY = "uglydeer:locale";

export const messages: Record<Locale, Messages> = {
  zh,
  en,
};

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}

export function isLocale(value: string | null): value is Locale {
  return value === "zh" || value === "en";
}

export const DEER_VOTE_STORAGE_KEY = "uglydeer:deer-vote";
export const DEER_VOTE_REVEAL_MS = 1250;
export const DEER_VOTE_SHARE_URL =
  (process.env.NEXT_PUBLIC_WEBSITE ?? "https://kairu.lol").replace(/\/$/, "");
export const DEER_VOTE_SHARE_HANDLE = "@UglyDeerSol";
export type { Locale, Messages, DeerVoteChoice } from "@/content/i18n/types";
