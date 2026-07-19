"use client";

import { useGameHrefContext } from "@/context/GameHrefContext";
import type { GameHrefMap } from "@/lib/game/paths";

/**
 * Host-aware game links.
 * On game.hansomealpacas.xyz: HOME=`/`, PLAY=`/dashboard` (from GameHrefProvider + Host header).
 * On www `/game/*`: HOME=`/game`, PLAY=`/game/dashboard` — marketing `/` unchanged.
 */
export function useGameHref(): GameHrefMap {
  return useGameHrefContext();
}
