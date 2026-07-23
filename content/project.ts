export type Project = {
  readonly name: string;
  readonly symbol: string;
  readonly chain: string;
  readonly taglineCN: string;
  readonly taglineEN: string;
  readonly description: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly ogTitle: string;
  readonly twitterTitle: string;
  readonly themeColor: string;
  readonly website: string;
  readonly twitter: string;
  readonly telegram: string;
  readonly contractAddress: string;
  readonly buyLink: string;
  readonly chartLink: string;
  readonly explorer: string;
  readonly network: string;
  readonly copyright: string;
};

/**
 * Single source of truth for brand identity. Everything else (metadata,
 * i18n copy, components, token config) should read from PROJECT / ASSETS
 * instead of hardcoding brand strings.
 */
export const PROJECT = {
  name: "HANSOME ALPACAS",
  symbol: "HANSOME",
  chain: "Robinhood Chain",
  taglineCN: "天生赢家脸，一辈子没屁用。",
  taglineEN: "Too handsome to be useful.",
  description:
    "The alpaca that won the genetic lottery. Pure meme, zero utility, live on Robinhood Chain.",
  metaTitle: "HANSOME ALPACAS | Too Handsome To Be Useful",
  metaDescription:
    "The alpaca that won the genetic lottery. Swap $HANSOME on Robinhood Chain.",
  ogTitle: "HANSOME ALPACAS",
  twitterTitle: "HANSOME ALPACAS",
  themeColor: "#BFE8F6",
  website: process.env.NEXT_PUBLIC_WEBSITE ?? "https://hansomealpacas.xyz",
  twitter: process.env.NEXT_PUBLIC_X ?? "https://x.com/HansomeAlpacas",
  telegram: process.env.NEXT_PUBLIC_TELEGRAM ?? "https://t.me/HandsomeAlpacasCommunity",
  contractAddress:
    process.env.NEXT_PUBLIC_CONTRACT ?? "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
  buyLink: process.env.NEXT_PUBLIC_BUY ?? "/swap",
  chartLink: process.env.NEXT_PUBLIC_CHART ?? "",
  explorer:
    process.env.NEXT_PUBLIC_EXPLORER ?? "https://robinhoodchain.blockscout.com",
  network: process.env.NEXT_PUBLIC_NETWORK ?? "Robinhood Chain",
  copyright: "© 2026 HANSOME ALPACAS",
} as const satisfies Project;

export const SOCIAL_PREVIEW_VERSION = 3 as const;

export const ASSETS = {
  logo: "/logo/coin.svg",
  /** Official mascot artwork with the flat background keyed to transparency. Use on non-black surfaces (e.g. the 3D hero coin face). */
  mascotCutout: "/logo/mascot-cutout.png",
  /** Canonical PNG (256×256). Use for token lists, wallet_watchAsset, hosted logoURI. */
  logoPng: "/logo/logo-256.png",
  logo256: "/logo/logo-256.png",
  /** Upscaled from logo-256 only. Use when a platform requires 512×512 upload (PWA manifest, etc.). */
  logo512: "/logo/logo-512.png",
  faviconIco: "/favicon.ico",
  favicon16: "/icons/favicon-16x16.png",
  favicon32: "/icons/favicon-32x32.png",
  favicon: "/icons/favicon-32x32.png",
  apple: "/icons/apple-touch-icon.png",
  avatar: "/images/avatar.png",
  og: `/images/opengraph-image-v3.png?v=${SOCIAL_PREVIEW_VERSION}`,
  twitterImage: `/images/twitter-image-v3.png?v=${SOCIAL_PREVIEW_VERSION}`,
  twitterBanner: "/images/twitter-banner.png",
  telegramBanner: "/images/telegram-banner.png",
  ambient: "/audio/ambient.wav",
} as const;
