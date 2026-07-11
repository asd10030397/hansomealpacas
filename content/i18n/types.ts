export type Locale = "zh" | "en";

export type GapAfter = "lg" | "md" | "none";

export type AboutBlock = {
  lines: readonly string[];
  gapAfter: GapAfter;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type Messages = {
  locale: Locale;
  htmlLang: string;
  language: {
    zh: string;
    en: string;
    toggleLabel: string;
  };
  a11y: {
    skipToContent: string;
    primaryLinks: string;
    socialLinks: string;
    coinAlt: string;
    copyContract: string;
    copiedContract: string;
    copyWebsite: string;
    shareDevice: string;
  };
  hero: {
    memeBadge: string;
    tagline: string;
    tickerLabel: string;
    ticker: string;
    chain: string;
    chainStatus: string;
    followX: string;
    buy: string;
    chart: string;
    x: string;
    telegram: string;
    website: string;
  };
  tokenomics: {
    eyebrow: string;
    title: string;
    subtitle: string;
    tickerLabel: string;
    ticker: string;
    items: readonly { label: string; value: string }[];
  };
  buy: {
    title: string;
    subtitle: string;
    cta: string;
    comingSoon: string;
  };
  about: {
    title: string;
    subtitle: string;
    blocks: readonly AboutBlock[];
  };
  faq: {
    eyebrow: string;
    title: string;
    items: readonly FaqItem[];
  };
  contract: {
    eyebrow: string;
    title: string;
    subtitle: string;
    addressLabel: string;
    placeholder: string;
    comingSoon: string;
    copied: string;
    copy: string;
    shareOnX: string;
    copyUrl: string;
    copyCa: string;
    share: string;
    copyFailed: string;
  };
  footer: {
    tagline: string;
    memeLovers: string;
    notFinancialAdvice: string;
    stayUgly: string;
    copyright: string;
    disclaimer: string;
  };
};
