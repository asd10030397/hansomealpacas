import type { Metadata, Viewport } from "next";
import { GameNav } from "@/components/game/GameNav";
import { GameVisualShell } from "@/components/game/GameVisualShell";
import { MobileGameDock } from "@/components/game/MobileGameDock";
import "@/styles/game.css";

export const metadata: Metadata = {
  title: "HANSOME: Alpacas vs Cougars",
  description:
    "Premium pixel-art GameFi — Commit, Reveal, Settle, Claim on Robinhood Chain.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0e121c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <GameVisualShell>
      <div className="hansome-game hansome-game-shell">
        <a
          href="#game-main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:bg-[#e8b03a] focus:px-3 focus:py-2 focus:text-[#1a1520]"
        >
          Skip to game content
        </a>
        <GameNav />
        <main id="game-main" className="hansome-game-main">
          {children}
        </main>
        <MobileGameDock />
      </div>
    </GameVisualShell>
  );
}
