import type { Metadata, Viewport } from "next";
import { Web3Provider } from "@/components/Web3Provider";
import { GameShell } from "@/components/game/GameShell";
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
    <Web3Provider>
      <GameShell>{children}</GameShell>
    </Web3Provider>
  );
}
