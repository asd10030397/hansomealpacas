"use client";

import { createContext, useContext, type ReactNode } from "react";
import { gameHref, type GameHrefMap } from "@/lib/game/paths";

const GameHrefContext = createContext<GameHrefMap>(gameHref);

/** Server-resolved href map (from Host header) so game.hansomealpacas.xyz SSRs `/` not `/game`. */
export function GameHrefProvider({
  value,
  children,
}: {
  value: GameHrefMap;
  children: ReactNode;
}) {
  return <GameHrefContext.Provider value={value}>{children}</GameHrefContext.Provider>;
}

export function useGameHrefContext(): GameHrefMap {
  return useContext(GameHrefContext);
}
