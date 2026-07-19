"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  mountAmbientSound,
  stopAmbientSoundHard,
} from "@/lib/ambient-sound";
import { isGameAudioRoute } from "@/lib/game/isGameChrome";

/**
 * Marketing-site ambient only.
 * On any Game surface (www `/game/*` or game.hansomealpacas.xyz), hard-stop
 * homepage BGM so it can never overlap Alpaca Warpath.
 */
export function AmbientSound() {
  const pathname = usePathname();
  const isDevPreview = pathname === "/dev" || pathname.startsWith("/dev/");

  useEffect(() => {
    const host = typeof window !== "undefined" ? window.location.hostname : null;
    const inGame = isGameAudioRoute(pathname, host) || isDevPreview;

    if (inGame) {
      stopAmbientSoundHard();
      return;
    }

    return mountAmbientSound();
  }, [pathname, isDevPreview]);

  return null;
}
