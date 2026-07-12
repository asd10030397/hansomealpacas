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
    <ol className="relative space-y-10 border-l border-white/10 pl-8">
      {phases.map((phase, i) => (
        <m.li
          key={phase.phase}
          className="relative"
          initial={{ opacity: reduceMotion ? 1 : 0, x: reduceMotion ? 0 : -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE, delay: i * 0.1 }}
        >
          <span
            aria-hidden="true"
            className="absolute -left-[2.15rem] top-1 h-3 w-3 rounded-full border-2 border-black bg-white"
          />

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{phase.phase}</span>
            <h3 className="text-lg font-semibold text-white">{phase.title}</h3>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium ${ROADMAP_STATUS_STYLES[phase.statusKey] ?? ""}`}
            >
              {phase.status}
            </span>
          </div>

          <ul className="mt-4 space-y-2">
            {phase.items.map((item) => (
              <li key={item.label} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/65">
                <span
                  aria-hidden="true"
                  className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[0.5rem] ${
                    item.done
                      ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-300"
                      : "border-white/20 text-transparent"
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
