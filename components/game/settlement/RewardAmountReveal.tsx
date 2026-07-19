"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { REWARD_COUNT_UP_RATIO } from "@/lib/game/presentationTiming";

function parseRewardAmount(label: string): {
  prefix: string;
  value: number | null;
  decimals: number;
  suffix: string;
} {
  const m = label.match(/^([+\-]?)([\d,]+(?:\.\d+)?)\s*(.*)$/);
  if (!m) {
    return { prefix: "", value: null, decimals: 0, suffix: label };
  }
  const raw = m[2].replace(/,/g, "");
  const decimals = raw.includes(".") ? (raw.split(".")[1]?.length ?? 0) : 0;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return { prefix: "", value: null, decimals: 0, suffix: label };
  }
  return {
    prefix: m[1] || (value > 0 ? "+" : ""),
    value,
    decimals,
    suffix: m[3] ? ` ${m[3]}`.replace(/\s+/g, " ") : "",
  };
}

function formatAmount(value: number, decimals: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals > 0 ? Math.min(decimals, 2) : 0,
    maximumFractionDigits: decimals > 0 ? Math.min(decimals, 2) : 0,
  });
}

/**
 * Count-up + floating reward pop for Battle Result cards (presentation only).
 */
export function RewardAmountReveal({
  rewardLabel,
  active,
  durationMs,
}: {
  rewardLabel: string;
  active: boolean;
  durationMs: number;
}) {
  const reduceMotion = useReducedMotion();
  const parsed = useMemo(() => parseRewardAmount(rewardLabel), [rewardLabel]);
  const [display, setDisplay] = useState(rewardLabel);
  const [showFloat, setShowFloat] = useState(false);

  useEffect(() => {
    if (!active || parsed.value == null || reduceMotion) {
      setDisplay(rewardLabel);
      setShowFloat(false);
      return;
    }

    setShowFloat(true);
    const target = parsed.value;
    const countMs = Math.max(400, Math.round(durationMs * REWARD_COUNT_UP_RATIO));
    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / countMs);
      // Smooth ease-out — readable, not laggy.
      const eased = 1 - (1 - t) ** 2.4;
      const current = target * eased;
      setDisplay(
        `${parsed.prefix}${formatAmount(current, parsed.decimals)}${parsed.suffix}`,
      );
      if (t < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        setDisplay(rewardLabel);
      }
    };

    frame = window.requestAnimationFrame(tick);
    const hideFloat = window.setTimeout(() => setShowFloat(false), durationMs);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(hideFloat);
    };
  }, [active, durationMs, parsed, reduceMotion, rewardLabel]);

  return (
    <div className="hg-settle-card__reward-wrap">
      <span
        className={`hg-settle-card__reward${active ? " hg-settle-card__reward--revealing" : ""}`}
      >
        {display}
      </span>
      {showFloat && parsed.value != null ? (
        <span className="hg-settle-card__reward-float" aria-hidden>
          {rewardLabel}
        </span>
      ) : null}
    </div>
  );
}
