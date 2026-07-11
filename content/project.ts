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

export const PROJECT = {
  name: "UGLY DEER",
  symbol: "UGLY",
  chain: "Robinhood Chain",
  taglineCN: "生來就醜。與眾不同。",
  taglineEN: "Born ugly. Built different.",
  description:
    "The internet's ugliest deer became a meme coin. Live on Robinhood Chain.",
  metaTitle: "UGLY DEER | The World's Ugliest Deer",
  metaDescription:
    "The internet's ugliest deer became a meme coin. Swap $UGLY on Robinhood Chain.",
  ogTitle: "UGLY DEER",
  twitterTitle: "UGLY DEER",
  themeColor: "#0D0D0D",
  website: process.env.NEXT_PUBLIC_WEBSITE ?? "https://kairu.lol",
  twitter: process.env.NEXT_PUBLIC_X ?? "",
  telegram: process.env.NEXT_PUBLIC_TELEGRAM ?? "",
  contractAddress:
    process.env.NEXT_PUBLIC_CONTRACT ?? "0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c",
  buyLink: process.env.NEXT_PUBLIC_BUY ?? "/swap",
  chartLink: process.env.NEXT_PUBLIC_CHART ?? "",
  explorer:
    process.env.NEXT_PUBLIC_EXPLORER ?? "https://robinhoodchain.blockscout.com",
  network: process.env.NEXT_PUBLIC_NETWORK ?? "Robinhood Chain",
  copyright: "© 2026 UGLY DEER",
} as const satisfies Project;

export const SOCIAL_PREVIEW_VERSION = 3 as const;

export const ASSETS = {
  logo: "/logo/coin.svg",
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
