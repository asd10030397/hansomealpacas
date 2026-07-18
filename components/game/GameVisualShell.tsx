"use client";

import { useEffect } from "react";

/**
 * Isolates /game/* from marketing body/html chrome.
 * Adds route class so CSS can override global sky background.
 */
export function GameVisualShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("hansome-game-route");
    body.classList.add("hansome-game-route");
    const prevBg = body.style.backgroundColor;
    body.style.backgroundColor = "#0e121c";

    return () => {
      html.classList.remove("hansome-game-route");
      body.classList.remove("hansome-game-route");
      body.style.backgroundColor = prevBg;
    };
  }, []);

  return <>{children}</>;
}
