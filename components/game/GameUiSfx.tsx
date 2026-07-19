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
    const fire = (target: EventTarget | null) => {
      if (!isSfxInteractiveTarget(target)) return;
      playSfx("ui-click");
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      fire(event.target);
    };

    // Keyboard activation (Enter/Space) fires click with detail === 0.
    const onClick = (event: MouseEvent) => {
      if (event.detail !== 0) return;
      fire(event.target);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
