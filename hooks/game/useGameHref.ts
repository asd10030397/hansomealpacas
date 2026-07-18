"use client";

import { useMemo } from "react";
import { getGameHref, type GameHrefMap } from "@/lib/game/paths";

/** Host-aware game links — HOME is `/` on game.hansomealpacas.xyz, `/game` on apex. */
export function useGameHref(): GameHrefMap {
  return useMemo(() => getGameHref(), []);
}
