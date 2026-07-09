export type Project = {
  readonly name: string;
  readonly symbol: string;
  readonly chain: string;
  readonly taglineCN: string;
  readonly taglineEN: string;
  readonly description: string;
  readonly website: string;
  readonly twitter: string;
  readonly telegram: string;
  readonly contractAddress: string;
  readonly buyLink: string;
  readonly chartLink: string;
  readonly copyright: string;
};

export const PROJECT = {
  name: "KAIRU",
  symbol: "KAIRU",
  chain: "Solana",
  taglineCN: "又到了嚕館的時間了。",
  taglineEN: "it's kairu time.",
  description: "KAIRU is a deer that never reacts.",
  website: process.env.NEXT_PUBLIC_WEBSITE ?? "",
  twitter: process.env.NEXT_PUBLIC_X ?? "",
  telegram: process.env.NEXT_PUBLIC_TELEGRAM ?? "",
  contractAddress: process.env.NEXT_PUBLIC_CONTRACT ?? "",
  buyLink: process.env.NEXT_PUBLIC_BUY ?? "",
  chartLink: process.env.NEXT_PUBLIC_CHART ?? "",
  copyright: "© 2026 KAIRU",
} as const satisfies Project;

export const ASSETS = {
  logo: "/logo/logo.svg",
  logo512: "/logo/logo-512.png",
  favicon: "/icons/favicon.png",
  avatar: "/images/avatar.png",
  og: "/images/og.png",
  twitterBanner: "/images/twitter-banner.png",
  telegramBanner: "/images/telegram-banner.png",
} as const;
