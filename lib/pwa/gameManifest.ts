import type { MetadataRoute } from "next";

/** Game chrome background — matches `styles/game.css` and game layout viewport. */
export const GAME_PWA_THEME_COLOR = "#0e121c" as const;

export const GAME_PWA = {
  name: "HANSOME: Alpacas vs Cougars",
  shortName: "HANSOME",
  description:
    "Premium pixel-art GameFi — Choose Location, Battle Result, Claim on Robinhood Chain.",
  /** Pretty URL on game host; middleware rewrites `/` → `/game` (title menu). */
  startUrl: "/",
  scope: "/",
  display: "standalone" as const,
  lang: "en",
  themeColor: GAME_PWA_THEME_COLOR,
  backgroundColor: GAME_PWA_THEME_COLOR,
  /** Canonical production host for Add to Home Screen identity. */
  id: "https://game.hansomealpacas.xyz/",
} as const;

export const GAME_PWA_ICONS = {
  icon192: "/icons/pwa/icon-192.png",
  icon512: "/icons/pwa/icon-512.png",
  icon512Maskable: "/icons/pwa/icon-512-maskable.png",
  appleTouch: "/icons/pwa/apple-touch-icon.png",
} as const;

/** Web App Manifest payload served on game.hansomealpacas.xyz (and game.localhost). */
export function buildGameManifest(): MetadataRoute.Manifest {
  return {
    id: GAME_PWA.id,
    name: GAME_PWA.name,
    short_name: GAME_PWA.shortName,
    description: GAME_PWA.description,
    start_url: GAME_PWA.startUrl,
    scope: GAME_PWA.scope,
    display: GAME_PWA.display,
    lang: GAME_PWA.lang,
    theme_color: GAME_PWA.themeColor,
    background_color: GAME_PWA.backgroundColor,
    orientation: "any",
    icons: [
      {
        src: GAME_PWA_ICONS.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: GAME_PWA_ICONS.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: GAME_PWA_ICONS.icon512Maskable,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: GAME_PWA_ICONS.appleTouch,
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
