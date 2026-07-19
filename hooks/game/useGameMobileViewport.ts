"use client";

import { useSyncExternalStore } from "react";
import { GAME_MOBILE_MEDIA } from "@/lib/game/breakpoints";

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(GAME_MOBILE_MEDIA);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(GAME_MOBILE_MEDIA).matches;
}

/** SSR / prerender: desktop chrome (avoids mounting mobile dock on server). */
function getServerSnapshot(): boolean {
  return false;
}

/** True when game chrome should use the mobile header + dock surface. */
export function useGameMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
