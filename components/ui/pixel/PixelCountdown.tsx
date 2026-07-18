"use client";

import { useEffect, useState } from "react";

function format(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return [h, m, r].map((n) => String(n).padStart(2, "0")).join(":");
}

export function PixelCountdown({
  endsAt,
  now,
  label,
}: {
  endsAt: number;
  now: number;
  label: string;
}) {
  const [display, setDisplay] = useState(format(endsAt - now));

  useEffect(() => {
    setDisplay(format(endsAt - now));
  }, [endsAt, now]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.65rem] uppercase tracking-wide text-[var(--hg-muted)]">
        {label}
      </span>
      <span
        className="pixel-title text-sm text-[#f0c44a] sm:text-base"
        aria-live="polite"
      >
        {display}
      </span>
    </div>
  );
}
