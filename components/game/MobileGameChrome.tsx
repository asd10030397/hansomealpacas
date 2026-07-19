"use client";

import { MobileGameDock } from "./MobileGameDock";
import { MobileGameHeader } from "./MobileGameHeader";

/** Mobile-only chrome surface: header + bottom dock. */
export function MobileGameChrome() {
  return (
    <div className="game-chrome game-chrome--mobile" data-game-chrome="mobile">
      <MobileGameHeader />
      <MobileGameDock />
    </div>
  );
}
