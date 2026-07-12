"use client";

import { m, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/motion";
import { useLocale } from "@/context/LocaleContext";
import { TOKENOMICS_SLICES } from "@/content/litepaper";

const RADIUS = 70;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TokenomicsDiagram() {
  const reduceMotion = useReducedMotion();
  const { t } = useLocale();
  const legend = t.litepaper.tokenomics.legend;
  let offsetAcc = 0;

  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:gap-12">
      <svg
        viewBox="0 0 180 180"
        width={200}
        height={200}
        role="img"
        aria-label={`${legend.treasury} ${TOKENOMICS_SLICES[0]?.percent}%, ${legend.liquidity} ${TOKENOMICS_SLICES[1]?.percent}%, ${legend.founder} ${TOKENOMICS_SLICES[2]?.percent}%`}
        className="shrink-0"
      >
        <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#ffffff14" strokeWidth={STROKE} />
        {TOKENOMICS_SLICES.map((slice, i) => {
          const length = (slice.percent / 100) * CIRCUMFERENCE;
          const dashArray = `${length} ${CIRCUMFERENCE - length}`;
          const rotation = (offsetAcc / 100) * 360 - 90;
          offsetAcc += slice.percent;

          return (
            <m.circle
              key={slice.key}
              cx="90"
              cy="90"
              r={RADIUS}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE}
              strokeDasharray={dashArray}
              strokeLinecap="butt"
              transform={`rotate(${rotation} 90 90)`}
              initial={{ pathLength: reduceMotion ? 1 : 0, opacity: reduceMotion ? 1 : 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 1, ease: EASE, delay: i * 0.15 }}
            />
          );
        })}
        <text x="90" y="85" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="600">
          1B
        </text>
        <text x="90" y="104" textAnchor="middle" fill="#ffffff80" fontSize="10" letterSpacing="0.1em">
          {t.litepaper.tokenomics.diagramCenterLabel}
        </text>
      </svg>

      <ul className="w-full space-y-3">
        {TOKENOMICS_SLICES.map((slice) => (
          <li key={slice.key} className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
            <span className="flex items-center gap-2.5 text-sm text-white/80">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              {legend[slice.key]}
            </span>
            <span className="text-sm font-semibold text-white">{slice.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
