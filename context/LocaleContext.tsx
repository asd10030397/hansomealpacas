"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getMessages,
  isLocale,
  type Locale,
} from "@/content/i18n";
import type { Messages } from "@/content/i18n/types";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

type LocaleContextValue = {
  locale: Locale;
  t: Messages;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored)) {
        setLocaleState(stored);
      }
    } catch {
      /* private browsing or blocked storage */
    } finally {
      setReady(true);
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState((current) => {
      if (current === next) return current;

      trackEvent(AnalyticsEvents.LANGUAGE_CHANGED, {
        language: next,
        previous_language: current,
      });

      return next;
    });

    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* private browsing or blocked storage */
    }
  }, []);

  const t = useMemo(() => getMessages(locale), [locale]);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = t.htmlLang;
  }, [ready, t.htmlLang]);

  const value = useMemo(
    () => ({
      locale,
      t,
      setLocale,
    }),
    [locale, t, setLocale],
  );

  if (!ready) {
    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
