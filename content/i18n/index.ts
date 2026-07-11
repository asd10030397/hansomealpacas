import { en } from "@/content/i18n/en";
import type { Locale, Messages } from "@/content/i18n/types";
import { zh } from "@/content/i18n/zh";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "uglydeer:locale";

export const messages: Record<Locale, Messages> = {
  en,
  zh,
};

function mergeMessages(base: Messages, override: Messages): Messages {
  return mergeValue(base, override) as Messages;
}

function mergeValue(base: unknown, override: unknown): unknown {
  if (typeof base === "string") {
    return typeof override === "string" && override.trim().length > 0 ? override : base;
  }

  if (Array.isArray(base)) {
    if (!Array.isArray(override)) return base;
    return base.map((item, index) => mergeValue(item, override[index]));
  }

  if (base && typeof base === "object") {
    const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };

    for (const [key, value] of Object.entries(base as Record<string, unknown>)) {
      result[key] = mergeValue(value, (override as Record<string, unknown>)?.[key]);
    }

    return result;
  }

  return override ?? base;
}

export function getMessages(locale: Locale): Messages {
  if (locale === "en") return en;
  return mergeMessages(en, zh);
}

export function isLocale(value: string | null): value is Locale {
  return value === "zh" || value === "en";
}

export type { Locale, Messages } from "@/content/i18n/types";
