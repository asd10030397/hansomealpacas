/**
 * Game UI copy — separate from marketing site Messages.
 * Add a new locale by creating `xx.ts` and registering it in `index.ts`.
 */

export type GameMessages = {
  language: {
    toggleLabel: string;
    en: string;
    zh: string;
  };
  common: {
    demoBanner: string;
    chainBadge: string;
    menu: string;
    close: string;
    loading: string;
    skipToContent: string;
    connectWallet: string;
    connectWalletMock: string;
    disconnectAria: string;
    connectAria: string;
    mockTapDisconnect: string;
    mockNoTx: string;
    notConnected: string;
    soonBadge: string;
    comingSoonTitle: string;
    comingSoonBody1: string;
    comingSoonBody2: string;
    comingSoonBody3: string;
    followX: string;
    joinTelegram: string;
    walletRequiredTitle: string;
    walletRequiredBody: (feature: string) => string;
    walletRequiredDemo: string;
  };
  nav: {
    brand: string;
    brandSub: string;
    home: string;
    game: string;
    mint: string;
    myNfts: string;
    rewards: string;
    board: string;
    docs: string;
    aria: string;
    mobileAria: string;
    featureMyNfts: string;
    featureRewards: string;
    featureLeaderboard: string;
  };
  dock: {
    aria: string;
    home: string;
    play: string;
    map: string;
    nfts: string;
    loot: string;
  };
  title: {
    eyebrow: string;
    tagline: string;
    menuAria: string;
    connect: string;
    connectSub: string;
    connectSubConnected: string;
    mint: string;
    mintSub: string;
    explore: string;
    exploreSub: string;
    cougarTerritory: string;
    cougarTag: string;
    alpacaRanch: string;
    alpacaTag: string;
  };
  dashboard: {
    heading: string;
    blurb: string;
    actionsTitle: string;
    actionsEyebrow: string;
    actionsHint: string;
    demoPhaseTitle: string;
    demoPhaseEyebrow: string;
  };
  mint: {
    loading: string;
    blurb: string;
    saleStatus: string;
    mintedLabel: string;
    supply: string;
    alpacas: string;
    cougars: string;
    reserved: string;
    whitelist: string;
    public: string;
    walletMax: string;
    price: string;
    wlEligibility: string;
    wlUnknown: string;
    yes: string;
    no: string;
    mintPanel: string;
    mintEyebrow: string;
    walletLine: (address: string, network: string) => string;
    quantity: string;
    decreaseAria: string;
    increaseAria: string;
  };
  explore: {
    heading: string;
    blurb: string;
  };
  myNfts: {
    heading: string;
    blurb: string;
  };
  rewards: {
    heading: string;
    blurb: string;
  };
  leaderboard: {
    heading: string;
    blurb: string;
  };
  commit: {
    heading: string;
    blurb: string;
  };
  reveal: {
    heading: string;
    blurb: string;
  };
  docs: {
    heading: string;
    blurb: string;
  };
  actions: {
    explore: string;
    myNfts: string;
    myAlpacas: string;
    myCougars: string;
    dailyGame: string;
    commit: string;
    reveal: string;
    rewards: string;
    claim: string;
    leaderboard: string;
    marketplace: string;
    staking: string;
  };
  features: {
    rewards: string;
    leaderboard: string;
    marketplace: string;
    staking: string;
    genesisMint: string;
    commit: string;
    reveal: string;
    claim: string;
    myAlpacas: string;
    myCougars: string;
    dailyGame: string;
    exploreWorld: string;
  };
};
