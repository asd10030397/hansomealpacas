"use client";

import { useEffect } from "react";
import { playSfx } from "@/lib/game/audio";
import { isSfxInteractiveTarget } from "@/lib/game/sfx";

/**
 * Plays ui-click for every button / link press inside the game shell.
 * Respects the SFX toggle; does not touch Music / BGM.
 */
export function GameUiSfx() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      // Primary button / touch / pen only
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!isSfxInteractiveTarget(event.target)) return;
      playSfx("ui-click");
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  return null;
}
