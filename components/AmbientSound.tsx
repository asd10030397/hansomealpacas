"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  fadeOutAmbientSound,
  mountAmbientSound,
} from "@/lib/ambient-sound";

export function AmbientSound() {
  const pathname = usePathname();
  const isGame = pathname === "/game" || pathname.startsWith("/game/");

  useEffect(() => {
    if (isGame) {
      // Hand off to gameplay battle theme (GameShell / GameplayMusic).
      fadeOutAmbientSound(1200);
      return;
    }
    return mountAmbientSound();
  }, [isGame]);

  return null;
}
