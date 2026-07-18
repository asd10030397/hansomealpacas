"use client";

import { useLocale } from "@/context/LocaleContext";

export function FlywheelDiagram() {
  const { t } = useLocale();
  const steps = t.litepaper.sustainableEcosystem.flywheel;

  return (
    <ol className="mx-auto flex w-full max-w-sm flex-col items-center gap-0">
      {steps.map((step, i) => (
        <li key={step} className="flex w-full flex-col items-center">
          <div className="lp-card w-full rounded-xl px-4 py-3 text-center">
            <p className="text-sm font-medium text-[color:var(--lp-text)]">{step}</p>
          </div>
          {i < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className="py-1.5 font-[family-name:var(--font-anton)] text-sm text-gold"
            >
              ↓
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
