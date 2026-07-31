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

export type LitepaperRevenueStatusKey = "active" | "planned" | "exploratory" | "inDevelopment";

export type LitepaperRevenueStream = {
  id: string;
  title: string;
  statusKey: LitepaperRevenueStatusKey;
  status: string;
  body: string;
};

export type LitepaperPolicyBlock = {
  heading: string;
  body: string;
  links?: readonly { href: string; label: string }[];
};

export type LitepaperRoadmapItem = {
  label: string;
  done: boolean;
};

export type LitepaperRoadmapStatusKey =
  | "completed"
  | "inProgress"
  | "inDevelopment"
  | "publicBeta"
  | "planned"
  | "conditional"
  | "legacy"
  | "future";

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

export type LitepaperProductStatusKey =
  | "inDevelopment"
  | "publicBeta"
  | "planned"
  | "conditional"
  | "legacy"
  | "live";

export type LitepaperBrandItem = {
  name: string;
  statusKey: LitepaperProductStatusKey;
  status: string;
  body: string;
};

export type LitepaperAxisItem = {
  title: string;
  body: string;
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
  downloadEconomicModelPdf: string;
  documentsLibrary: {
    heading: string;
    blurb: string;
    litepaperEn: string;
    litepaperZh: string;
    economicPdfEn: string;
    economicPdfZh: string;
    economicMdEn: string;
    economicMdZh: string;
    openInBrowser: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    meta: readonly LitepaperHeroMetaItem[];
  };
  statusLabels: {
    live: string;
    publicBeta: string;
    inDevelopment: string;
    planned: string;
    conditional: string;
    legacy: string;
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
  memeIdentity: {
    heading: string;
    slogan: string;
    tagline: string;
    paragraphs: readonly string[];
    pillars: readonly LitepaperPillar[];
  };
  brandHierarchy: {
    heading: string;
    intro: string;
    items: readonly LitepaperBrandItem[];
  };
  scanScore: {
    heading: string;
    status: string;
    statusKey: LitepaperProductStatusKey;
    paragraphs: readonly string[];
    tryScan: {
      button: string;
      href: string;
      blurb: string;
    };
    capabilitiesHeading: string;
    capabilities: readonly string[];
    modulesHeading: string;
    modules: readonly LitepaperPillar[];
    overallBandsHeading: string;
    overallBandsIntro: string;
    overallBands: readonly string[];
    howItWorksHeading: string;
    howItWorks: readonly string[];
    limitationsHeading: string;
    limitations: readonly string[];
    principlesHeading: string;
    principles: readonly string[];
    v4LockIntelligence: {
      heading: string;
      status: string;
      statusKey: LitepaperProductStatusKey;
      problem: readonly string[];
      capabilitiesHeading: string;
      capabilities: readonly string[];
      statusesHeading: string;
      statuses: readonly string[];
      interpretationHeading: string;
      interpretation: readonly string[];
      whyItMatters: readonly string[];
      scoreRelationshipHeading: string;
      scoreRelationship: readonly string[];
      maturityNote: string;
    };
  };
  axesConfidence: {
    heading: string;
    intro: string;
    axes: readonly LitepaperAxisItem[];
    principlesHeading: string;
    principles: readonly string[];
  };
  explore: {
    heading: string;
    status: string;
    paragraphs: readonly string[];
  };
  hansomeUtility: {
    heading: string;
    paragraphs: readonly string[];
    items: readonly LitepaperPillar[];
  };
  /** Nested under Legacy section in the UI; kept as top-level keys for diagram components. */
  gameplayOverview: {
    heading: string;
    opening: string;
    paragraphs: readonly string[];
    roles: readonly string[];
    loopLabel: string;
    closing: readonly string[];
    imageAlt: string;
    captionTitle: string;
    captionLines: readonly string[];
    cta: {
      heading: string;
      body: string;
      bullets: readonly string[];
      button: string;
      href: string;
    };
  };
  gamefiEconomicModel: {
    heading: string;
    intro: readonly string[];
    highlightsHeading: string;
    highlights: readonly string[];
    disclaimer: string;
    linksHeading: string;
    links: {
      reportEn: string;
      reportZh: string;
      pdfEn: string;
      pdfZh: string;
      game: string;
    };
    hrefs: {
      reportEn: string;
      reportZh: string;
      pdfEn: string;
      pdfZh: string;
      game: string;
    };
  };
  sustainableEcosystem: {
    heading: string;
    paragraphs: readonly string[];
    investments: readonly string[];
    flywheel: readonly string[];
    closing: readonly string[];
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
    concentratedLiquidity: LitepaperPolicyBlock;
    longTermStrategy: LitepaperPolicyBlock;
    lpFees: LitepaperPolicyBlock;
    onChainVerification: LitepaperPolicyBlock;
    liquidityOptimization: LitepaperPolicyBlock;
    improvedTradingExperience: LitepaperPolicyBlock;
    multiplePositions: LitepaperPolicyBlock;
    noReactiveChasing: LitepaperPolicyBlock;
  };
  revenue: {
    heading: string;
    intro: string;
    streams: readonly LitepaperRevenueStream[];
  };
  roadmap: {
    heading: string;
    intro: string;
    phases: readonly LitepaperRoadmapPhase[];
  };
  legacy: {
    heading: string;
    status: string;
    intro: readonly string[];
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
    scan: string;
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
  link?: { href: string; label: string };
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
    playGame: string;
    hansomeScan: string;
    swapHansome: string;
    downloadAndroidApp: string;
    downloadAndroidSubtext: string;
    downloadAndroidInstallNote: string;
    buy: string;
    chart: string;
    x: string;
    telegram: string;
    website: string;
  };
  download: {
    meta: {
      title: string;
      description: string;
    };
    backHome: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    buildDate: string;
    fileSize: string;
    sha256: string;
    downloadApk: string;
    downloadSubtext: string;
    directApkNote: string;
    installHeading: string;
    installSteps: readonly string[];
    installNote: string;
    versionedLabel: string;
    stableLabel: string;
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
    disconnectWallet: string;
    switchNetwork: string;
    youPay: string;
    youReceive: string;
    balance: string;
    slippage: string;
    flipDirection: string;
    fillPercent: string;
    fillMax: string;
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
      connectionFailed: string;
      confirming: string;
      approvingToken: string;
      approvingPermit2: string;
      swapping: string;
      swapComplete: string;
    };
  };
  scan: {
    backHome: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    subtitleSecondary: string;
    subtitleTertiary: string;
    addressLabel: string;
    addressPlaceholder: string;
    scan: string;
    scanning: string;
    /** Short disclaimer under the address input (landing). */
    landingDisclaimer: string;
    landingDisclaimerSecondary: string;
    /** Compact capability line under Scan button (segments joined with ·). */
    capabilityRobinhood: string;
    capabilityUniswap: string;
    capabilityUniswapTooltip: string;
    capabilityScores: string;
    capabilityHansomeLevel: string;
    capabilityCoverage: string;
    pasteAddress: string;
    scanFailed: string;
    /** Malformed / invalid address format (title). */
    invalidAddressTitle: string;
    /** Hint under invalid-address title — Robinhood Chain check only. */
    invalidAddressHint: string;
    /** Valid hex/checksum but no supported ERC-20 on Robinhood Chain. */
    tokenNotFound: string;
    score: string;
    overallScore: string;
    overallSubtitle: string;
    overallTooltip: string;
    overallComponentsHint: string;
    overallBandLegendTitle: string;
    overallBandLegendHint: string;
    structuralScore: string;
    structuralTooltip: string;
    activity: string;
    hansomeLevel: string;
    hansomeLevelInfoTitle: string;
    hansomeLevelInfoBody: string;
    hansomeLevelBasis: string;
    hansomeLevelDescNotHansome: string;
    hansomeLevelDescKindaHansome: string;
    hansomeLevelDescHansome: string;
    hansomeLevelDescVeryHansome: string;
    hansomeLevelDescTooHansome: string;
    rawActivity: string;
    confidence: string;
    confidenceTooltip: string;
    confidenceSubtitle: string;
    confidenceBreakdown: string;
    confidenceDimContract: string;
    confidenceDimLiquidity: string;
    confidenceDimHolders: string;
    confidenceDimWallet: string;
    confidenceDimCreator: string;
    confidenceBandHigh: string;
    confidenceBandMedium: string;
    confidenceBandLow: string;
    confidenceDimLine: string;
    confidenceDimBlurbContract: string;
    confidenceDimBlurbContractIncomplete: string;
    confidenceDimBlurbLiquidity: string;
    confidenceDimBlurbLiquidityIncomplete: string;
    confidenceDimBlurbHoldersHigh: string;
    confidenceDimBlurbHoldersMedium: string;
    confidenceDimBlurbHoldersLow: string;
    confidenceDimBlurbWallet: string;
    confidenceDimBlurbWalletSampled: string;
    confidenceDimBlurbCreator: string;
    confidenceDimBlurbCreatorIncomplete: string;
    confidenceDimWarnBuySellSim: string;
    confidenceDimWarnLiquidityRanges: string;
    confidenceDimWarnLiquidityIncomplete: string;
    confidenceAdvancedDetails: string;
    confidenceAdvancedWeight: string;
    confidenceAdvancedEvidence: string;
    confidenceAdvancedNotes: string;
    confidenceAdvancedIncomplete: string;
    confidenceAdvancedIncompleteYes: string;
    confidenceAdvancedIncompleteNo: string;
    confidenceAdvancedPenalties: string;
    activitySource: string;
    overview: string;
    name: string;
    address: string;
    totalSupply: string;
    holders: string;
    deployer: string;
    /** Creator explainability — presentation only */
    creatorDeployerTooltip: string;
    creatorAddressTooltip: string;
    creatorBalanceTooltip: string;
    creatorSoldTooltip: string;
    creatorBurnedTooltip: string;
    creatorReceivedTooltip: string;
    creatorCurrentOwnerTooltip: string;
    creatorProxyTooltip: string;
    creatorUnknownTooltip: string;
    creatorIncompleteTooltip: string;
    creatorAvailableTooltip: string;
    creatorActivityTooltip: string;
    creatorTransferredTooltip: string;
    creatorDeploymentSourceTooltip: string;
    creatorFundingWalletTooltip: string;
    creatorCoverageTooltip: string;
    creatorAddressLabel: string;
    creatorBalanceLabel: string;
    creatorBalancePctLabel: string;
    creatorSoldLabel: string;
    creatorSoldPctLabel: string;
    creatorBurnedLabel: string;
    creatorReceivedLabel: string;
    creatorTransferredLabel: string;
    creatorActivityLabel: string;
    creatorAvailableLabel: string;
    creatorIncompleteLabel: string;
    creatorUnknownLabel: string;
    creatorDeploymentSourceLabel: string;
    creatorProxyLabel: string;
    creatorCurrentOwnerLabel: string;
    creatorFundingWalletLabel: string;
    creatorUnavailableLabel: string;
    creatorProxyYes: string;
    creatorProxyNo: string;
    poolManagerBalance: string;
    top10RawAdjusted: string;
    adjustedNote: string;
    /** Holder explainability — presentation only */
    holderLargestTooltip: string;
    holderTop10Tooltip: string;
    holderConcentrationTooltip: string;
    holderKnownBurnedTooltip: string;
    holderLpPoolTooltip: string;
    holderTreasuryTooltip: string;
    holderTeamDeployerTooltip: string;
    holderExchangeTooltip: string;
    holderBridgeTooltip: string;
    holderLockerTooltip: string;
    holderProtocolContractTooltip: string;
    holderUnknownWalletTooltip: string;
    holderExcludedFromCirculatingTooltip: string;
    holderIncludedInRawTooltip: string;
    holderCoverageIncompleteTooltip: string;
    holderUnknownWalletLabel: string;
    holderRawTop10Label: string;
    holderAdjustedTop10Label: string;
    holderDenominatorTotalSupply: string;
    holderLargestLabel: string;
    contractRisk: string;
    liquidity: string;
    poolsDetectedOne: string;
    poolsDetectedMany: string;
    poolsDetectedNone: string;
    poolLiquidity: string;
    liquidityUnavailable: string;
    /** Multi-pool: per-card USD withheld; value already in section total. */
    poolLiquidityIncludedInTotal: string;
    poolLiquidityIncludedInTotalSubtitle: string;
    poolLiquidityIncludedInTotalTooltip: string;
    lockStatus: string;
    lockStatusLocked: string;
    lockStatusUnlocked: string;
    lockStatusPartiallyLocked: string;
    lockStatusUnknown: string;
    /** V4 ownership class (PosM NFT vs hook-native) — separate from lock status. */
    v4Ownership: string;
    v4OwnershipPosmNft: string;
    v4OwnershipHookNative: string;
    v4OwnershipUnknown: string;
    /** Phase 11A.1 — expandable ownership evidence (presentation only). */
    v4OwnershipEvidence: string;
    v4OwnershipEvidenceTechnical: string;
    /** Phase 11E — Hook Position Index (discovery only; no lock/USD). */
    hookPositions: string;
    hookPositionsDetected: string;
    hookPositionIndexStatus: string;
    hookPositionIndexComplete: string;
    hookPositionIndexPartial: string;
    hookPositionIndexPartialHint: string;
    /** Phase 11F/G/H — Hook Native intelligence (candidate; not Titan). */
    hookOwnedLiquidity: string;
    hookOwnedValue: string;
    foreignLpDiscovery: string;
    foreignLpDiscoveryComplete: string;
    foreignLpDiscoveryPartial: string;
    hookLockModel: string;
    hookLockPrincipalOnchain: string;
    hookLockTimed: string;
    hookLockPermanent: string;
    hookLockUnlockable: string;
    hookLockMigrationPending: string;
    hookLockExited: string;
    hookLockGraduatedIncomplete: string;
    hookLockUnknownIncomplete: string;
    hookLockUnknownDiscoveryIncomplete: string;
    hookLockTechnicalNote: string;
    hookIntelligenceTechnical: string;
    v4EvidencePositionNftDetected: string;
    v4EvidencePositionNftIds: string;
    v4EvidencePoolMatched: string;
    v4EvidenceOwnerOfVerified: string;
    v4EvidenceMaterialLiquidity: string;
    v4EvidenceTitanOwnership: string;
    v4EvidenceDiscoveryIncomplete: string;
    v4EvidenceAirlockDoppler: string;
    v4EvidenceDynamicFee: string;
    v4EvidenceHookNoPosm: string;
    v4EvidenceActiveHookLiquidity: string;
    v4EvidenceOwnershipUnproven: string;
    positionsLabel: string;
    lockedPositionsLabel: string;
    unlockedPositionsLabel: string;
    unknownPositionsLabel: string;
    lockedCountLabel: string;
    unlockedCountLabel: string;
    unknownCountLabel: string;
    lockDistributionTitle: string;
    lockedLiquidityValue: string;
    unlockedLiquidityValue: string;
    unknownLiquidityValue: string;
    lockedLiquidityUnavailable: string;
    unlockedLiquidityUnavailable: string;
    lockPercentageUnavailable: string;
    lockDistributionUnavailableReason: string;
    lockDetails: string;
    positionLockedUntil: string;
    positionLocked: string;
    positionUnlocked: string;
    positionUnknown: string;
    positionValueSuffix: string;
    positionValueUnavailable: string;
    uniswapVersionLabel: string;
    totalPools: string;
    totalLiquidity: string;
    supportedVersions: string;
    supportedVersionsNote: string;
    liquidityViewTechnicalDetails: string;
    /** Advanced Details (kept for transparency) */
    liquidityIntro: string;
    versionsDetected: string;
    versionsNone: string;
    poolsPerVersion: string;
    incompleteCoverageBanner: string;
    protocolVsLockerNote: string;
    liquiditySize: string;
    poolDetected: string;
    yes: string;
    no: string;
    poolId: string;
    poolManagerBal: string;
    thinSizeWarning: string;
    ownershipWithdrawal: string;
    ownershipEvidence: string;
    positionNft: string;
    owner: string;
    locker: string;
    unlock: string;
    removableByEoa: string;
    notEoaRemovable: string;
    range: string;
    rangeUnknown: string;
    inRange: string;
    outOfRange: string;
    ticks: string;
    current: string;
    source: string;
    evidence: string;
    lockTx: string;
    noPositions: string;
    discovery: string;
    aggregateBanner: string;
    positionCounts: string;
    poolsVsPositions: string;
    lockDistribution: string;
    lockPctUnavailable: string;
    completenessWarning: string;
    /** Known/seeded positions revalidated; exhaustive history may still be pending. */
    verifiedKnownPositions: string;
    /** Exhaustive PositionManager discovery finished. */
    fullPositionDiscoveryComplete: string;
    principleOneLocked: string;
    pairFee: string;
    internalAggregateState: string;
    creatorBehaviour: string;
    creatorStatusClean: string;
    creatorStatusSome: string;
    creatorStatusSignificant: string;
    creatorStatusInsufficient: string;
    creatorDirectSells: string;
    creatorTransferThenSell: string;
    creatorTransferThenSellNone: string;
    creatorTransferThenSellCount: string;
    creatorSupplySold: string;
    creatorSupplySoldValue: string;
    creatorTxAnalyzed: string;
    creatorExplainClean: string;
    creatorExplainSome: string;
    creatorExplainSignificant: string;
    creatorExplainInsufficient: string;
    creatorDataStatus: string;
    creatorDataComplete: string;
    creatorDataPartial: string;
    creatorDataLimited: string;
    creatorDisclaimer: string;
    creatorViewTechnicalDetails: string;
    creatorAdvancedPages: string;
    creatorAdvancedTransfers: string;
    creatorAdvancedOutbound: string;
    creatorAdvancedPagination: string;
    creatorAdvancedPaginationYes: string;
    creatorAdvancedPaginationNo: string;
    creatorAdvancedAvailable: string;
    creatorAdvancedAvailableYes: string;
    creatorAdvancedAvailableNo: string;
    creatorAdvancedStatusRaw: string;
    creatorAdvancedMethodology: string;
    creatorAdvancedEvidence: string;
    creatorAdvancedEngineDetail: string;
    supplyBurn: string;
    supplyBurnTotalSupply: string;
    supplyBurnKnownBurned: string;
    supplyBurnKnownBurnedLine: string;
    supplyBurnKnownBurnedTooltip: string;
    supplyBurnRemaining: string;
    supplyBurnRemainingUnavailable: string;
    supplyBurnRemainingFootnote: string;
    supplyBurnDeadVsReduced: string;
    supplyBurnNoKnownBurn: string;
    supplyBurnMechanism: string;
    supplyBurnFunction: string;
    supplyBurnFunctionTooltip: string;
    supplyBurnHolderBurn: string;
    supplyBurnBurnFrom: string;
    supplyBurnAutomatic: string;
    supplyBurnAutomaticTooltip: string;
    supplyBurnPrivileged: string;
    supplyBurnPrivilegedTooltip: string;
    supplyBurnPrivilegedYes: string;
    supplyBurnSupplyReduced: string;
    supplyBurnTriYes: string;
    supplyBurnTriNo: string;
    supplyBurnTriUnknown: string;
    supplyBurnViewTechnicalDetails: string;
    supplyBurnAdvancedMethod: string;
    supplyBurnAdvancedMechanism: string;
    supplyBurnAdvancedDeadBalances: string;
    supplyBurnAdvancedNotes: string;
    supplyBurnAdvancedFindings: string;
    supplyBurnNoScoreBoost: string;
    supplyBurnActivity: string;
    supplyBurn24h: string;
    supplyBurn7d: string;
    supplyBurn30d: string;
    supplyBurnAllTimeKnown: string;
    supplyBurnLastBurn: string;
    supplyBurnLastBurnNever: string;
    supplyBurnLastBurnUnknown: string;
    supplyBurnTxCount: string;
    supplyBurnIncomplete: string;
    supplyBurnReductionHeading: string;
    supplyBurnDeadInventory: string;
    supplyBurnProvenReduction: string;
    supplyBurnHistoricalStatus: string;
    supplyBurnStatusVerified: string;
    supplyBurnStatusPartial: string;
    supplyBurnStatusUnknown: string;
    deductions: string;
    noDeductions: string;
    scoreCeiling: string;
    categoryTotals: string;
    catContract: string;
    catLpOwnership: string;
    catConcentration: string;
    catRelationships: string;
    catLaunch: string;
    catCreator: string;
    deductionCategoryLabel: string;
    deductionSignalLabel: string;
    deductionCategories: {
      contract_risk: string;
      liquidity_ownership: string;
      holder_concentration: string;
      wallet_relationship: string;
      launch_fairness: string;
      creator_behaviour: string;
    };
    deductionSignals: {
      equal_balance_cluster: string;
      shared_funding_pattern: string;
      deployer_funded_holders: string;
      same_block_early_buys: string;
      deployer_in_cluster: string;
      top1_ge_50: string;
      top1_ge_30: string;
      top1_ge_20: string;
      top1_ge_10: string;
      top1_ge_5: string;
      top10_ge_80: string;
      top10_ge_60: string;
      top10_ge_50: string;
      top10_ge_40: string;
      lp_none: string;
      lp_unlocked_eoa: string;
      lp_unable_to_determine: string;
      lp_mixed: string;
      lp_lock_expiry_unknown: string;
      lp_unsupported_locker: string;
      mintable: string;
      honeypot: string;
      tax_ge_50: string;
      tax_gt_0: string;
      modifiable_tax: string;
      pausable: string;
      blacklist_whitelist: string;
      proxy_upgrade: string;
      owner_admin: string;
      privileged_burn: string;
      contract_risk_incomplete: string;
      deployer_ge_20: string;
      deployer_ge_10: string;
      deployer_ge_5: string;
      unverified_contract: string;
      creator_dump: string;
      creator_transfer_then_sell: string;
      creator_behaviour_unindexed: string;
    };
    riskFlags: string;
    topHolders: string;
    /** Advanced Details only — never inline with holder rows */
    exclFromConcentration: string;
    holderLabelPoolManager: string;
    holderLabelLiquidityPool: string;
    holderLabelOfficial: string;
    holderLabelFounder: string;
    holderLabelBurn: string;
    holdersAdvancedDetails: string;
    dataSources: string;
    affectsScore: string;
    activityLabelsOnly: string;
    scannedAt: string;
    lastUpdated: string;
    lastUpdatedStale: string;
    scoreComputedAt: string;
    activityUpdatedAt: string;
    fromCache: string;
    refreshAnalysis: string;
    refreshingAnalysis: string;
    refreshCooldown: string;
    scanningProgress: string;
    deepAnalysisInProgress: string;
    deepAnalysisProgress: string;
    deepAnalysisComplete: string;
    deepAnalysisPartial: string;
    deepAnalysisPartialNote: string;
    deepAnalysisStillAnalyzing: string;
    deepStageEstimateRelationships: string;
    deepStageEstimateCreator: string;
    deepStageEstimateLiquidity: string;
    deepStageEstimateBurn: string;
    /** Honest progressive Deep progress bar copy */
    progressOverallLabel: string;
    progressModulesCompleted: string;
    progressActiveStage: string;
    progressTimeVaries: string;
    progressWaiting: string;
    progressCollecting: string;
    progressAnalyzingContract: string;
    progressCollectingLiquidity: string;
    progressAnalyzingLpLocks: string;
    progressScanningHolders: string;
    progressScanningBurn: string;
    progressScanningCreator: string;
    progressTracingWallets: string;
    progressRetrying: string;
    progressComplete: string;
    progressUnavailable: string;
    progressUnavailableDetail: string;
    progressWorkflowCollecting: string;
    progressWorkflowRetrying: string;
    progressWorkflowComplete: string;
    progressWorkflowUnavailable: string;
    /** Honest stall copy when durable progress has not advanced. */
    progressStalled: string;
    progressLastUpdate: string;
    moduleProgressStructural: string;
    moduleProgressHolders: string;
    moduleProgressLiquidity: string;
    moduleProgressBurn: string;
    moduleProgressCreator: string;
    moduleProgressRelationships: string;
    sectionAnalyzing: string;
    deepFieldCollecting: string;
    deepFieldTemporarilyUnavailable: string;
    deepCollectingProgress: string;
    deepCollectingRetry: string;
    liquidityCollecting: string;
    liquidityAnalyzingLabel: string;
    liquidityEstimatedTime: string;
    creatorCollecting: string;
    creatorAnalyzingLabel: string;
    creatorEstimatedTime: string;
    burnCollecting: string;
    burnAnalyzingLabel: string;
    burnEstimatedTime: string;
    scoreProvisionalBadge: string;
    scoreProvisionalNote: string;
    stageContract: string;
    stageHolders: string;
    stageMarket: string;
    stageBurn: string;
    stageLiquidity: string;
    stageCreator: string;
    stageRelationships: string;
    stageScore: string;
    stageDone: string;
    stageAnalyzing: string;
    stagePending: string;
    stagePartial: string;
    stageUnavailable: string;
    stageUnknown: string;
    disclaimers: string;
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
  chart: {
    eyebrow: string;
    title: string;
    subtitle: string;
    iframeTitle: string;
    viewOnDextools: string;
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
    scan: string;
    privacy: string;
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
