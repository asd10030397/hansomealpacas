"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CLICKS_REQUIRED = 10;
const HOLD_MS = 1000;
const FADE_MS = 500;

export function useUglyDeerEasterEgg() {
  const [active, setActive] = useState(false);
  const clicksRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    setActive(false);
    clicksRef.current = 0;
  }, []);

  const handleMascotClick = useCallback(() => {
    if (active) return;

    clicksRef.current += 1;

    if (clicksRef.current >= CLICKS_REQUIRED) {
      setActive(true);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;

    timerRef.current = window.setTimeout(dismiss, FADE_MS + HOLD_MS + FADE_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [active, dismiss]);

  return {
    active,
    handleMascotClick,
    fadeMs: FADE_MS,
    holdMs: HOLD_MS,
  };
}
