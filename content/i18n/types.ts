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

export type LitepaperHeroMetaItem = {
  label: string;
  value: string;
};

export type LitepaperPillar = {
  title: string;
  body: string;
};

export type LitepaperDistributionRow = {
  label: string;
  value: string;
  note: string;
};

export type LitepaperTreasuryLine = {
  label: string;
  value: string;
  detail: string;
};

export type LitepaperWalletBlurb = {
  title: string;
  purpose: string;
  allocation: string;
};

export type LitepaperRevenueStatusKey = "active" | "planned" | "exploratory";

export type LitepaperRevenueStream = {
  id: string;
  title: string;
  statusKey: LitepaperRevenueStatusKey;
  status: string;
  body: string;
};

export type LitepaperRoadmapItem = {
  label: string;
  done: boolean;
};

export type LitepaperRoadmapStatusKey = "completed" | "inProgress" | "future";

export type LitepaperRoadmapPhase = {
  phase: string;
  title: string;
  statusKey: LitepaperRoadmapStatusKey;
  status: string;
  items: readonly LitepaperRoadmapItem[];
};

export type LitepaperLifecycleStep = {
  label: string;
  body: string;
};

export type LitepaperFaqItem = {
  question: string;
  answer: string;
};

export type LitepaperChangelogEntry = {
  version: string;
  date: string;
  changes: readonly string[];
};

export type LitepaperMessages = {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    onThisPage: string;
    sections: Record<string, string>;
  };
  backHome: string;
  downloadPdf: string;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    meta: readonly LitepaperHeroMetaItem[];
  };
  statusLabels: {
    live: string;
    planned: string;
    exploratory: string;
  };
  founderLetter: {
    heading: string;
    paragraphs: readonly string[];
    signature: string;
  };
  introduction: {
    heading: string;
    paragraphs: readonly string[];
    whatIsHansome: {
      heading: string;
      paragraphs: readonly string[];
    };
  };
  vision: {
    heading: string;
    paragraphs: readonly string[];
  };
  philosophy: {
    heading: string;
    pillars: readonly LitepaperPillar[];
  };
  tokenomics: {
    heading: string;
    diagramCenterLabel: string;
    legend: {
      treasury: string;
      liquidity: string;
      founder: string;
    };
    totalSupply: {
      heading: string;
      value: string;
      body: string;
    };
    distribution: {
      heading: string;
      body: string;
      rows: readonly LitepaperDistributionRow[];
      footnote: string;
    };
    whyFixedSupply: {
      heading: string;
      body: string;
    };
  };
  treasury: {
    heading: string;
    intro: string;
    lines: readonly LitepaperTreasuryLine[];
    transparencyHeading: string;
    transparencyBody: string;
    wallets: readonly LitepaperWalletBlurb[];
    viewWallets: string;
  };
  liquidity: {
    heading: string;
    concentratedLiquidity: { heading: string; body: string };
    longTermStrategy: { heading: string; body: string };
    lpFees: { heading: string; body: string };
    multiplePositions: { heading: string; body: string };
    noReactiveChasing: { heading: string; body: string };
  };
  revenue: {
    heading: string;
    intro: string;
    streams: readonly LitepaperRevenueStream[];
  };
  roadmap: {
    heading: string;
    phases: readonly LitepaperRoadmapPhase[];
  };
  community: {
    heading: string;
    paragraphs: readonly string[];
  };
  longTermVision: {
    heading: string;
    intro: string;
    lifecycle: readonly LitepaperLifecycleStep[];
    loopLabel: string;
    closing: string;
  };
  faq: {
    heading: string;
    items: readonly LitepaperFaqItem[];
  };
  changelog: {
    heading: string;
    intro: string;
    entries: readonly LitepaperChangelogEntry[];
  };
  language: {
    heading: string;
    body: string;
  };
  closing: {
    note: string;
    home: string;
    transparency: string;
    swap: string;
  };
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
    readLitepaper: string;
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
    litepaper: string;
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
  litepaper: LitepaperMessages;
};
