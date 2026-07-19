"use client";

import { useSyncExternalStore } from "react";
import { getGameHref, type GameHrefMap } from "@/lib/game/paths";

const subscribe = () => () => {};

/** Host-aware links for game.hansomealpacas.xyz vs www /game/* — does not change marketing `/`. */
export function useGameHref(): GameHrefMap {
  return useSyncExternalStore(
    subscribe,
    () => getGameHref(window.location.hostname),
    () => getGameHref(null),
  );
}
