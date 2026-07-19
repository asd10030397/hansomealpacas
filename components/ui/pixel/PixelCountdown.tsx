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

const URGENT_MS = 5 * 60 * 1000;

export function PixelCountdown({
  endsAt,
  now,
  label,
}: {
  endsAt: number;
  now: number;
  label: string;
}) {
  const remaining = endsAt - now;
  const [display, setDisplay] = useState(format(remaining));

  useEffect(() => {
    setDisplay(format(endsAt - now));
  }, [endsAt, now]);

  const ended = remaining <= 0;
  const urgent = !ended && remaining <= URGENT_MS;

  return (
    <div className="hg-countdown">
      <span className="hg-countdown__label">{label}</span>
      <span
        className={`hg-countdown__digits${
          ended ? " hg-countdown__digits--ended" : urgent ? " hg-countdown__digits--urgent" : ""
        }`}
        aria-live="polite"
        aria-atomic="true"
      >
        {display}
      </span>
    </div>
  );
}
