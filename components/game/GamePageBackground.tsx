"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  PAGE_BG_EVENT,
  resolvePageBackground,
  type PageBgTheme,
} from "@/lib/game/pageBackground";
import { getPendingLocation } from "@/lib/game/commitSecret";
import { useGameState } from "@/hooks/game/useGameState";

function readLocationFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("location");
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 4 ? n : null;
}

/** Applies `data-bg` on the game shell for themed scenic backgrounds. */
export function useGamePageBackground(): PageBgTheme {
  const pathname = usePathname() ?? "/game";
  const { day } = useGameState();
  const [locationId, setLocationId] = useState<number | null>(null);

  useEffect(() => {
    const fromUrl = readLocationFromUrl();
    const fromPending = getPendingLocation(day.day);
    setLocationId(fromUrl ?? fromPending);

    const onCustom = (ev: Event) => {
      const detail = (ev as CustomEvent<{ locationId: number | null }>).detail;
      setLocationId(detail?.locationId ?? null);
    };
    const onPop = () => {
      setLocationId(readLocationFromUrl() ?? getPendingLocation(day.day));
    };

    window.addEventListener(PAGE_BG_EVENT, onCustom);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener(PAGE_BG_EVENT, onCustom);
      window.removeEventListener("popstate", onPop);
    };
  }, [pathname, day.day]);

  return resolvePageBackground(pathname, { locationId });
}
