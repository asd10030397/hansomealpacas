"use client";

import { m, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/motion";
import { useLocale } from "@/context/LocaleContext";

function pointOnCircle(index: number, count: number, radiusPct: number) {
  const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
  return {
    left: 50 + radiusPct * Math.cos(angle),
    top: 50 + radiusPct * Math.sin(angle),
    angleDeg: (angle * 180) / Math.PI,
  };
}

export function LifecycleDiagram() {
  const reduceMotion = useReducedMotion();
  const { t } = useLocale();
  const steps = t.litepaper.longTermVision.lifecycle;
  const count = steps.length;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="50" cy="50" r="38" fill="none" stroke="#ffffff20" strokeWidth="0.5" strokeDasharray="2 3" />
      </svg>

      {steps.map((step, i) => {
        const { left, top } = pointOnCircle(i, count, 38);
        const midAngle = pointOnCircle(i + 0.5, count, 38);

        return (
          <div key={step.label}>
            <span
              aria-hidden="true"
              className="absolute -translate-x-1/2 -translate-y-1/2 select-none text-[0.7rem] text-white/35"
              style={{
                left: `${midAngle.left}%`,
                top: `${midAngle.top}%`,
                transform: `translate(-50%, -50%) rotate(${midAngle.angleDeg + 90}deg)`,
              }}
            >
              &darr;
            </span>

            <m.div
              className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center sm:w-28"
              style={{ left: `${left}%`, top: `${top}%` }}
              initial={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, ease: EASE, delay: i * 0.12 }}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-white sm:h-16 sm:w-16">
                {step.label}
              </span>
              <span className="text-[0.6875rem] leading-snug text-white/45">{step.body}</span>
            </m.div>
          </div>
        );
      })}

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
        <span aria-hidden="true" className="text-2xl">
          🦙
        </span>
        <span className="mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-white/35">
          {t.litepaper.longTermVision.loopLabel}
        </span>
      </div>
    </div>
  );
}
