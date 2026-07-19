import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Web3Provider } from "@/components/Web3Provider";
import { GameShell } from "@/components/game/GameShell";
import { GameHrefProvider } from "@/context/GameHrefContext";
import { WalletConnectProvider } from "@/context/WalletConnectContext";
import { getGameHref } from "@/lib/game/paths";
import "@/styles/game.css";
import "@/styles/game-polish.css";
import "@/styles/game-chrome-shared.css";
import "@/styles/game-chrome-desktop.css";
import "@/styles/game-chrome-mobile.css";

export const metadata: Metadata = {
  title: "HANSOME: Alpacas vs Cougars",
  description:
    "Premium pixel-art GameFi — Choose Location → Battle Result → Claim on Robinhood Chain.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0e121c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const host = (await headers()).get("host");
  const hrefs = getGameHref(host);

  return (
    <Web3Provider>
      <WalletConnectProvider>
        <GameHrefProvider value={hrefs}>
          <GameShell>{children}</GameShell>
        </GameHrefProvider>
      </WalletConnectProvider>
    </Web3Provider>
  );
}
