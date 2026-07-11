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

export type TokenomicsItem = {
  label: string;
  value?: string;
  valueLines?: readonly string[];
  secondary?: string;
  badge?: string;
  variant?: "default" | "network" | "ticker";
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
    items: readonly TokenomicsItem[];
  };
  buy: {
    title: string;
    subtitle: string;
    cta: string;
    ctaSublabel: string;
    launchingSoon: string;
    comingSoon: string;
  };
  swap: {
    eyebrow: string;
    title: string;
    subtitle: string;
    backHome: string;
    connectWallet: string;
    switchNetwork: string;
    youPay: string;
    youReceive: string;
    balance: string;
    slippage: string;
    flipDirection: string;
    swap: string;
    swapping: string;
    approveToken: string;
    approveRouter: string;
    addToWallet: string;
    watchAssetSuccess: string;
    watchAssetFailed: string;
    watchAssetRejected: string;
    viewOnBlockscout: string;
    viewTx: string;
    network: string;
    status: {
      loading: string;
      success: string;
      failed: string;
      confirming: string;
      approvingToken: string;
      approvingPermit2: string;
      swapping: string;
      swapComplete: string;
    };
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
    viewExplorer: string;
    viewOfficialWallets: string;
    shareOnX: string;
    copyUrl: string;
    copyCa: string;
    share: string;
    copyFailed: string;
  };
  liveStatus: {
    title: string;
    network: string;
    token: string;
    supply: string;
    tax: string;
    status: string;
    statusPreparing: string;
    statusLive: string;
  };
  community: {
    eyebrow: string;
    title: string;
    holders: string;
    transactions: string;
    liquidity: string;
    marketCap: string;
    comingSoon: string;
  };
  market: {
    eyebrow: string;
    title: string;
    subtitle: string;
    loading: string;
    unavailable: string;
    tokenPrice: string;
    liquidity: string;
    change24h: string;
    volume24h: string;
    transactions24h: string;
    txBuys: string;
    txSells: string;
    liveRefresh: string;
  };
  footer: {
    tagline: string;
    memeLovers: string;
    notFinancialAdvice: string;
    stayHansome: string;
    builtOn: string;
    explorer: string;
    transparency: string;
    copyright: string;
    disclaimer: string;
  };
  transparency: {
    purpose: string;
    liquidityPosition: string;
    allocation: string;
    address: string;
    copyAddress: string;
    copied: string;
    viewBlockscout: string;
  };
};
