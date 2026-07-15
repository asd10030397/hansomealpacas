"use client";

import { m, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/motion";
import { useLocale } from "@/context/LocaleContext";
import { ROADMAP_STATUS_STYLES } from "@/content/litepaper";

export function RoadmapTimeline() {
  const reduceMotion = useReducedMotion();
  const { t } = useLocale();
  const phases = t.litepaper.roadmap.phases;

  return (
    <ol className="relative space-y-10 border-l-2 border-wood/50 pl-8">
      {phases.map((phase, i) => (
        <m.li
          key={phase.phase}
          className="relative"
          initial={{ opacity: reduceMotion ? 1 : 0, x: reduceMotion ? 0 : -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE, delay: i * 0.1 }}
        >
          <span aria-hidden="true" className="absolute -left-[2.35rem] top-1 h-3 w-3 border-2 border-wood bg-gold" />

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-[family-name:var(--font-anton)] text-[0.6rem] tracking-[0.2em] text-[color:var(--lp-text-faint)]">
              {phase.phase}
            </span>
            <h3 className="text-lg font-semibold text-[color:var(--lp-text)]">{phase.title}</h3>
            <span
              className={`border px-2.5 py-0.5 text-[0.6875rem] font-medium ${ROADMAP_STATUS_STYLES[phase.statusKey] ?? ""}`}
            >
              {phase.status}
            </span>
          </div>

          <ul className="mt-4 space-y-2">
            {phase.items.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-2.5 text-sm leading-relaxed text-[color:var(--lp-text-muted)]"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center border text-[0.5rem] ${
                    item.done ? "border-grass/60 bg-grass/20 text-grass" : "border-wood/40 text-transparent"
                  }`}
                >
                  {item.done ? "✓" : ""}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </m.li>
      ))}
    </ol>
  );
}
