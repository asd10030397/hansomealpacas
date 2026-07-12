"use client";

import { useLocale } from "@/context/LocaleContext";
import { LITEPAPER_SECTION_ORDER } from "@/content/litepaper";
import { useLitepaperActiveSection } from "@/components/litepaper/LitepaperActiveSectionContext";

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Sticky sidebar TOC — desktop / large screens only. Render as a flex sibling of the content column. */
export function LitepaperDesktopNav() {
  const { t } = useLocale();
  const { activeId } = useLitepaperActiveSection();

  return (
    <nav
      aria-label={t.litepaper.nav.onThisPage}
      className="no-print sticky top-24 hidden max-h-[calc(100vh-8rem)] w-56 shrink-0 overflow-y-auto pr-2 lg:block"
    >
      <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-white/40">{t.litepaper.nav.onThisPage}</p>
      <ul className="space-y-1 border-l border-white/10">
        {LITEPAPER_SECTION_ORDER.map((id) => {
          const active = id === activeId;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => scrollToSection(id)}
                aria-current={active ? "true" : undefined}
                className={`-ml-px block w-full border-l pl-4 py-1.5 text-left text-[0.8125rem] leading-snug transition-colors duration-200 ${
                  active ? "border-white text-white" : "border-transparent text-white/45 hover:text-white/80"
                }`}
              >
                {t.litepaper.nav.sections[id] ?? id}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Horizontal pill bar TOC — mobile / tablet only. Render full-width, above the content column. */
export function LitepaperMobileNav() {
  const { t } = useLocale();
  const { activeId } = useLitepaperActiveSection();

  return (
    <nav
      aria-label={t.litepaper.nav.onThisPage}
      className="no-print sticky top-20 z-30 flex gap-2 overflow-x-auto border-b border-white/10 bg-black/90 px-6 py-3 backdrop-blur-sm lg:hidden"
    >
      {LITEPAPER_SECTION_ORDER.map((id) => {
        const active = id === activeId;
        return (
          <button
            key={id}
            type="button"
            onClick={() => scrollToSection(id)}
            aria-current={active ? "true" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
              active
                ? "border-white bg-white text-black"
                : "border-white/15 text-white/60 hover:border-white/30 hover:text-white"
            }`}
          >
            {t.litepaper.nav.sections[id] ?? id}
          </button>
        );
      })}
    </nav>
  );
}
