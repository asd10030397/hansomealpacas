"use client";

import { useSyncExternalStore } from "react";
import { getGameHref, type GameHrefMap } from "@/lib/game/paths";

const subscribe = () => () => {};

function getClientHref(): GameHrefMap {
  return getGameHref(window.location.hostname);
}

function getServerHref(): GameHrefMap {
  // Apex defaults: HOME=/ , PLAY=/game/dashboard. Game host hydrates via client snapshot.
  return getGameHref(null);
}

/** Host-aware game links — HOME is always the marketing landing, never a game route. */
export function useGameHref(): GameHrefMap {
  return useSyncExternalStore(subscribe, getClientHref, getServerHref);
}
