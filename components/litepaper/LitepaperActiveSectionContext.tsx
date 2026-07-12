"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/context/LocaleContext";

type ActiveSectionContextValue = {
  activeId: string;
  /** True for a brief moment right after a language switch, while the page re-anchors scroll to the active section. */
  isTransitioning: boolean;
};

const ActiveSectionContext = createContext<ActiveSectionContextValue | null>(null);

/**
 * Tracks which section is currently in view (via IntersectionObserver) and,
 * whenever the site-wide language switches, re-anchors scroll to that same
 * section right after the new text renders — so switching language doesn't
 * bounce the reader back to the top or to some other section.
 */
export function LitepaperActiveSectionProvider({
  sectionIds,
  children,
}: {
  sectionIds: readonly string[];
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const [activeId, setActiveId] = useState<string>(sectionIds[0] ?? "");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const activeIdRef = useRef(activeId);
  const prevLocaleRef = useRef(locale);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: [0, 1] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  useEffect(() => {
    if (prevLocaleRef.current === locale) return;
    prevLocaleRef.current = locale;

    setIsTransitioning(true);
    const id = activeIdRef.current;

    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    });
    const timeout = setTimeout(() => setIsTransitioning(false), 280);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [locale]);

  return (
    <ActiveSectionContext.Provider value={{ activeId, isTransitioning }}>{children}</ActiveSectionContext.Provider>
  );
}

export function useLitepaperActiveSection() {
  const ctx = useContext(ActiveSectionContext);
  if (!ctx) {
    throw new Error("useLitepaperActiveSection must be used within LitepaperActiveSectionProvider");
  }
  return ctx;
}
