"use client";

import { m, useReducedMotion } from "framer-motion";
import { PROJECT } from "@/content/project";
import { useLocale } from "@/context/LocaleContext";
import { getLiveStatusState } from "@/lib/launch";
import { EASE } from "@/lib/motion";

const SUPPLY = "1,000,000,000";
const TAX = "0%";

export function LiveStatusSection() {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const { network, isLive } = getLiveStatusState();

  const rows = [
    { label: t.liveStatus.network, value: network },
    { label: t.liveStatus.token, value: PROJECT.symbol },
    { label: t.liveStatus.supply, value: SUPPLY },
    { label: t.liveStatus.tax, value: TAX },
    {
      label: t.liveStatus.status,
      value: isLive ? t.liveStatus.statusLive : t.liveStatus.statusPreparing,
      isStatus: true,
    },
  ] as const;

  return (
    <section aria-labelledby="live-status-title" className="relative z-20 -mt-10 px-6 pb-4 sm:-mt-12 sm:pb-6">
      <m.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-5%" }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: EASE }}
        className="live-status-card mx-auto w-full max-w-3xl rounded-2xl px-5 py-6 sm:px-8 sm:py-7"
      >
        <div className="flex items-center justify-center gap-2.5">
          <span
            aria-hidden="true"
            className={`live-status-dot ${isLive ? "live-status-dot--live" : ""}`}
          />
          <h2
            id="live-status-title"
            className="font-[family-name:var(--font-anton)] text-xs tracking-[0.32em] text-gold/75 sm:text-sm sm:tracking-[0.36em]"
          >
            {t.liveStatus.title}
          </h2>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 border-b border-white/[0.04] pb-3 last:border-b-0 sm:last:border-b sm:[&:nth-last-child(-n+2)]:border-b-0"
            >
              <dt className="text-xs uppercase tracking-[0.18em] text-muted sm:text-sm">{row.label}</dt>
              <dd
                className={`text-right text-sm tabular-nums sm:text-base ${
                  "isStatus" in row && row.isStatus
                    ? "font-medium text-gold-light"
                    : "font-medium text-foreground"
                }`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </m.div>
    </section>
  );
}
