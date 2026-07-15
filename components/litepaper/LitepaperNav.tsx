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
      <p className="mb-4 font-[family-name:var(--font-anton)] text-[0.6rem] tracking-[0.18em] text-[color:var(--lp-text-faint)]">
        {t.litepaper.nav.onThisPage}
      </p>
      <ul className="space-y-1">
        {LITEPAPER_SECTION_ORDER.map((id) => {
          const active = id === activeId;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => scrollToSection(id)}
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-center gap-2.5 py-1.5 text-left text-[0.8125rem] leading-snug transition-colors duration-200 ${
                  active ? "font-semibold text-gold" : "text-[color:var(--lp-text-faint)] hover:text-[color:var(--lp-text-muted)]"
                }`}
              >
                <span aria-hidden="true" className={`lp-pixel-dot ${active ? "lp-pixel-dot--active" : ""}`} />
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
      className="no-print sticky top-20 z-30 flex gap-2 overflow-x-auto px-6 py-3 backdrop-blur-sm lg:hidden"
      style={{ backgroundColor: "color-mix(in srgb, var(--lp-bg) 92%, transparent)", borderBottom: "3px solid var(--color-wood)" }}
    >
      {LITEPAPER_SECTION_ORDER.map((id) => {
        const active = id === activeId;
        return (
          <button
            key={id}
            type="button"
            onClick={() => scrollToSection(id)}
            aria-current={active ? "true" : undefined}
            className={`shrink-0 whitespace-nowrap border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
              active
                ? "border-wood bg-gold text-wood-dark"
                : "border-wood/40 text-[color:var(--lp-text-faint)] hover:border-wood hover:text-[color:var(--lp-text)]"
            }`}
          >
            {t.litepaper.nav.sections[id] ?? id}
          </button>
        );
      })}
    </nav>
  );
}
