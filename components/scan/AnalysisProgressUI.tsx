"use client";

import { useEffect, useRef, useState } from "react";
import type { Messages } from "@/content/i18n/types";
import type {
  AnalysisModuleKey,
  AnalysisModuleProgress,
  AnalysisProgressMessageKey,
  AnalysisWorkflowProgress,
} from "@/lib/hansome-score/analysis-progress";
import {
  buildProgressPanelView,
  moduleTitleFromCopy,
} from "@/lib/hansome-score/analysis-progress-view";

type ScanMessages = Messages["scan"];

export function progressMessage(
  s: ScanMessages,
  key: AnalysisProgressMessageKey,
): string {
  return s[key];
}

export function moduleTitle(s: ScanMessages, key: AnalysisModuleKey): string {
  return moduleTitleFromCopy(s, key);
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

/**
 * Animate from previous real numeric value → next real value.
 * Does not fabricate intermediate score checkpoints — only interpolates display.
 */
export function AnimatedRealNumber({
  value,
  className,
  suffix = "",
  durationMs = 420,
}: {
  value: number;
  className?: string;
  suffix?: string;
  durationMs?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || !Number.isFinite(value)) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    if (fromRef.current === value) {
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const to = value;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, reduced, durationMs]);

  const shown = Number.isInteger(value)
    ? Math.round(display)
    : Math.round(display * 10) / 10;

  return (
    <span className={className}>
      {shown}
      {suffix}
    </span>
  );
}

export function HonestProgressBar({
  percent,
  label,
  statusText,
  unavailable = false,
}: {
  percent: number;
  label?: string;
  statusText?: string;
  unavailable?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const reduced = usePrefersReducedMotion();
  return (
    <div className="w-full min-w-0">
      {label || statusText != null ? (
        <div className="mb-1 flex min-w-0 items-baseline justify-between gap-2 text-[0.65rem] tracking-[0.06em] sm:text-xs">
          {label ? (
            <span className="min-w-0 truncate text-foreground">{label}</span>
          ) : (
            <span />
          )}
          <span className="shrink-0 tabular-nums text-muted">
            {unavailable && pct < 100 ? `${pct}%` : `${pct}%`}
          </span>
        </div>
      ) : null}
      <div className="h-3 border-2 border-[#0d1018] bg-[#0d1018] p-0.5 shadow-[2px_2px_0_#0d1018] sm:h-3.5">
        <div
          className={`h-full bg-[linear-gradient(90deg,#e8b03a,#f0c44a)] ${
            reduced ? "" : "transition-[width] duration-300 ease-out"
          } ${unavailable ? "opacity-70" : ""}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
      {statusText ? (
        <p
          className={`mt-1 text-[0.65rem] leading-relaxed sm:text-xs ${
            unavailable ? "text-amber-950/80" : "text-muted"
          }`}
        >
          {statusText}
        </p>
      ) : null}
    </div>
  );
}

export function ModuleProgressRow({
  module,
  s,
  compact = false,
}: {
  module: AnalysisModuleProgress;
  s: ScanMessages;
  compact?: boolean;
}) {
  const unavailable = module.status === "unavailable";
  const statusText =
    unavailable && module.progress < 100
      ? `${progressMessage(s, module.messageKey)}${
          compact ? "" : ` — ${s.progressUnavailableDetail}`
        }`
      : progressMessage(s, module.messageKey);

  return (
    <div
      className={compact ? "mt-2" : "mt-2.5"}
      data-module-progress={module.key}
    >
      <HonestProgressBar
        percent={module.progress}
        label={compact ? undefined : moduleTitle(s, module.key)}
        statusText={statusText}
        unavailable={unavailable}
      />
    </div>
  );
}

export function OverallDeepProgressPanel({
  workflow,
  s,
  etaLine,
  indexProgressLine,
  retryLine,
  lastUpdateLine,
  stallLine,
  footerNote,
}: {
  workflow: AnalysisWorkflowProgress;
  s: ScanMessages;
  etaLine?: string | null;
  indexProgressLine?: string | null;
  retryLine?: string | null;
  lastUpdateLine?: string | null;
  stallLine?: string | null;
  footerNote?: string | null;
}) {
  const view = buildProgressPanelView(workflow, s);

  return (
    <div
      className="gold-border rounded-2xl px-4 py-3 text-left sm:px-5"
      aria-live="polite"
      data-testid="overall-deep-progress"
      data-workflow-status={view.workflowStatus}
      data-overall-progress={view.overallProgress}
      data-coverage={view.analysisCoveragePercent ?? ""}
      data-stalled={stallLine ? "1" : "0"}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.12em] text-gold-light sm:text-sm">
          {view.overallLabel}
        </p>
        <p className="text-[0.65rem] tracking-[0.08em] text-muted sm:text-xs">
          {view.workflowStatusLabel}
        </p>
      </div>

      <div className="mt-2.5">
        <HonestProgressBar percent={view.overallProgress} />
      </div>

      <p className="mt-2 text-[0.65rem] leading-relaxed text-foreground sm:text-xs">
        {view.modulesCompletedLine}
      </p>

      {view.activeStageLine ? (
        <p className="mt-1 text-[0.65rem] leading-relaxed text-amber-900 sm:text-xs">
          {view.activeStageLine}
        </p>
      ) : null}

      {view.unavailableDetail ? (
        <p className="mt-1 text-[0.65rem] leading-relaxed text-muted/80 sm:text-xs">
          {view.unavailableDetail}
        </p>
      ) : null}

      <ul className="mt-3 space-y-2.5 border-t border-gold-light/15 pt-3">
        {workflow.modules.map((m) => (
          <li key={m.key}>
            <ModuleProgressRow module={m} s={s} />
          </li>
        ))}
      </ul>

      {etaLine ? (
        <p className="mt-2 text-[0.65rem] leading-relaxed text-muted/75 sm:text-xs">
          {etaLine}
        </p>
      ) : null}
      {indexProgressLine ? (
        <p className="mt-1.5 text-[0.65rem] leading-relaxed text-muted/75 sm:text-xs">
          {indexProgressLine}
        </p>
      ) : null}
      {lastUpdateLine ? (
        <p className="mt-1 text-[0.65rem] leading-relaxed text-muted/70 sm:text-xs">
          {lastUpdateLine}
        </p>
      ) : null}
      {stallLine ? (
        <p
          className="mt-1 text-[0.65rem] leading-relaxed text-amber-950/85 sm:text-xs"
          data-testid="progress-stall-message"
        >
          {stallLine}
        </p>
      ) : null}
      {retryLine ? (
        <p className="mt-1 text-[0.65rem] leading-relaxed text-muted/70 sm:text-xs">
          {retryLine}
        </p>
      ) : null}
      {footerNote ? (
        <p className="mt-2 text-[0.65rem] leading-relaxed text-muted/80 sm:text-xs">
          {footerNote}
        </p>
      ) : null}
    </div>
  );
}
