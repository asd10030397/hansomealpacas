import type { Messages } from "@/content/i18n/types";

export const en: Messages = {
  locale: "en",
  htmlLang: "en",
  language: {
    zh: "中文",
    en: "EN",
    toggleLabel: "Language",
  },
  a11y: {
    skipToContent: "Skip to content",
    primaryLinks: "Primary links",
    socialLinks: "Social links",
    coinAlt: "HANSOME ALPACAS gold coin",
    copyContract: "Copy contract address",
    copiedContract: "Copied",
    copyWebsite: "Copy website URL",
    shareDevice: "Share via device",
  },
  hero: {
    memeBadge: "MEME COIN",
    tagline: "The alpaca that won the genetic lottery.",
    tickerLabel: "Ticker",
    ticker: "$HANSOME",
    chain: "Robinhood Chain",
    chainStatus: "(Pre-Launch)",
    readLitepaper: "📖 Read Litepaper",
    playGame: "🎮 Play Game",
    downloadAndroidApp: "Download Android App",
    downloadAndroidSubtext: "Android APK · Direct Download",
    downloadAndroidInstallNote:
      "Android may ask to allow installation from this source.",
    buy: "BUY",
    chart: "CHART",
    x: "X",
    telegram: "TELEGRAM",
    website: "WEBSITE",
  },
  tokenomics: {
    eyebrow: "TOKENOMICS",
    title: "TOKENOMICS",
    subtitle: "Pure meme coin math. Zero tax. Zero utility promises.",
    tickerLabel: "Ticker",
    ticker: "$HANSOME",
    items: [
      { label: "TICKER", value: "HANSOME", variant: "ticker" },
      { label: "SUPPLY", value: "1B", secondary: "1,000,000,000 HANSOME" },
      {
        label: "NETWORK",
        valueLines: ["Robinhood", "Chain"],
        badge: "Launching Soon",
        variant: "network",
      },
      { label: "TAX", value: "0%" },
      {
        label: "LIQUIDITY",
        value: "Locked",
        secondary: "Until Jul 2027",
        link: { href: "/transparency", label: "View Lock →" },
      },
    ],
  },
  buy: {
    title: "BUY $HANSOME",
    subtitle:
      "Swap ETH for HANSOME directly on hansomealpacas.xyz — powered by Uniswap Universal Router.",
    cta: "GET HANSOME",
    ctaSublabel: "Feed the alpacas",
    launchingSoon: "Launching Soon",
    comingSoon: "(Coming Soon)",
  },
  swap: {
    eyebrow: "SWAP",
    title: "SWAP",
    subtitle: "Trade ETH and HANSOME on Robinhood Chain via Uniswap Universal Router.",
    backHome: "HOME",
    connectWallet: "CONNECT WALLET",
    disconnectWallet: "DISCONNECT",
    switchNetwork: "SWITCH TO ROBINHOOD CHAIN",
    youPay: "YOU PAY",
    youReceive: "YOU RECEIVE",
    balance: "Balance",
    slippage: "Slippage tolerance",
    flipDirection: "Flip swap direction",
    fillPercent: "Fill",
    fillMax: "Fill max available",
    swap: "SWAP",
    swapping: "SWAPPING…",
    approveToken: "APPROVE HANSOME",
    approveRouter: "APPROVE ROUTER",
    addToWallet: "ADD HANSOME TO WALLET",
    watchAssetSuccess: "HANSOME added to wallet — check MetaMask for the logo.",
    watchAssetFailed: "Could not add HANSOME to wallet.",
    watchAssetRejected: "You declined adding HANSOME to the wallet.",
    viewOnBlockscout: "View on Blockscout",
    viewTx: "View transaction",
    network: "Network",
    status: {
      loading: "TRANSACTION PENDING",
      success: "SWAP SUCCESSFUL",
      failed: "TRANSACTION FAILED",
      connectionFailed: "WALLET CONNECTION",
      confirming: "Waiting for confirmation…",
      approvingToken: "Approving HANSOME for Permit2…",
      approvingPermit2: "Approving Universal Router…",
      swapping: "Submitting swap…",
      swapComplete: "Your swap is complete.",
    },
  },
  about: {
    title: "WTF IS HANSOME ALPACAS?",
    subtitle: "HANSOME ALPACAS is a community-driven meme coin.",
    blocks: [
      { lines: ["The alpaca that won the genetic lottery."], gapAfter: "lg" },
      { lines: ["Every ecosystem has a mascot."], gapAfter: "lg" },
      { lines: ["We got the best-looking one."], gapAfter: "lg" },
      {
        lines: ["Perfect fur.", "Dead-set jawline.", "Zero marketable skills."],
        gapAfter: "lg",
      },
      { lines: ["CT didn't make us famous."], gapAfter: "md" },
      { lines: ["Being hansome did."], gapAfter: "none" },
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "FAQ",
    items: [
      {
        question: "Is HANSOME a meme coin?",
        answer:
          "Yes. 100%. HANSOME ALPACAS is a community meme coin — culture first, vibes second, finance disclaimers always.",
      },
      {
        question: "What is $HANSOME?",
        answer: "A meme coin. One extremely handsome alpaca. One ticker. That's it.",
      },
      {
        question: "When is launch?",
        answer: "Preparing for launch on Robinhood Chain. Swap at hansomealpacas.xyz/swap.",
      },
      {
        question: "Where do I buy?",
        answer: "Here. Once live. Not before.",
      },
      {
        question: "Is there an airdrop?",
        answer: "Something fun is coming... Stay tuned for future community events.",
      },
      {
        question: "What chain?",
        answer: "Robinhood Chain.",
      },
      {
        question: "Does HANSOME do anything?",
        answer: "Right now? Just being extremely handsome. Future utilities and special events — coming soon.",
      },
    ],
  },
  contract: {
    eyebrow: "CONTRACT",
    title: "CONTRACT ADDRESS",
    subtitle: "Official Contract Address",
    addressLabel: "OFFICIAL CA",
    placeholder: "Contract will be published at launch.",
    comingSoon: "COMING SOON",
    copied: "COPIED",
    copy: "COPY",
    viewExplorer: "View on Explorer",
    viewOfficialWallets: "View Official Wallets",
    shareOnX: "SHARE ON X",
    copyUrl: "COPY URL",
    copyCa: "COPY CA",
    share: "SHARE",
    copyFailed: "Copy failed. Try again.",
  },
  download: {
    meta: {
      title: "Download Android App | HANSOME ALPACAS",
      description:
        "Direct APK download for the HANSOME game on Android. Build date, file size, and SHA-256 checksum included.",
    },
    backHome: "← HOME",
    eyebrow: "ANDROID APP",
    title: "Download Android App",
    subtitle:
      "Install the HANSOME game on Android with a direct APK download — not from Google Play.",
    buildDate: "Build date",
    fileSize: "File size",
    sha256: "SHA-256",
    downloadApk: "Download APK",
    downloadSubtext: "Android APK · Direct Download",
    directApkNote:
      "Stable URL: game.hansomealpacas.xyz/downloads/hansome-android.apk — versioned builds are kept for verification.",
    installHeading: "Install steps",
    installSteps: [
      "Download the APK using the button above.",
      "Open the downloaded file from your browser or Files app.",
      "If prompted, allow installation from this browser or file manager.",
      "Tap Install, then open HANSOME from your home screen.",
    ],
    installNote:
      "Android may ask to allow installation from this source. This is a debug build for direct sideloading only — not distributed via Google Play.",
    versionedLabel: "Versioned build",
    stableLabel: "Stable download",
  },
  liveStatus: {
    title: "LIVE STATUS",
    network: "Network",
    token: "Token",
    supply: "Supply",
    tax: "Tax",
    status: "Status",
    statusPreparing: "Preparing Launch",
    statusLive: "Live",
  },
  community: {
    eyebrow: "COMMUNITY",
    title: "COMMUNITY",
    holders: "Holders",
    transactions: "Transactions",
    liquidity: "Liquidity",
    marketCap: "Market Cap",
    comingSoon: "Coming Soon",
  },
  market: {
    eyebrow: "MARKET",
    title: "MARKET STATS",
    subtitle: "Live HANSOME/ETH pool data from GeckoTerminal (Uniswap v4 on Robinhood Chain).",
    loading: "Loading",
    unavailable: "Market data temporarily unavailable",
    tokenPrice: "HANSOME Price",
    liquidity: "Liquidity",
    change24h: "24H Change",
    volume24h: "24H Volume",
    transactions24h: "24H Transactions",
    txBuys: "buys",
    txSells: "sells",
    liveRefresh: "Auto-refreshes every 30s · Source: GeckoTerminal",
  },
  chart: {
    eyebrow: "LIVE CHART",
    title: "Live $HANSOME Chart",
    subtitle: "Real-time HANSOME/ETH price action on Robinhood Chain via DEXTools.",
    iframeTitle: "HANSOME live price chart on DEXTools",
    viewOnDextools: "View on DEXTools",
  },
  footer: {
    tagline: "Too handsome to be useful.",
    memeLovers: "Made for meme lovers.",
    notFinancialAdvice: "Not financial advice.",
    stayHansome: "Stay Hansome. 🦙",
    builtOn: "Built on Robinhood Chain",
    explorer: "Explorer",
    transparency: "Transparency",
    litepaper: "Litepaper",
    scan: "Score Scan",
    copyright: "© 2026 HANSOME ALPACAS",
    disclaimer:
      "$HANSOME is a meme coin with no intrinsic value or promised returns. This site is entertainment only. Crypto is volatile. DYOR. Only ape what you can lose.",
  },
  transparency: {
    purpose: "Purpose",
    liquidityPosition: "Liquidity Position",
    allocation: "Allocation",
    address: "Address",
    copyAddress: "Copy Address",
    copied: "Copied",
    viewBlockscout: "View on Blockscout",
  },
  litepaper: {
    meta: {
      title: "Litepaper | HANSOME ALPACAS",
      description:
        "HANSOME 2.0 litepaper: meme identity, Scan & Score (in development), Explore (planned), tokenomics, treasury, liquidity, roadmap, and Legacy GameFi — what's true today, without pretending Scan is production-live.",
    },
    nav: {
      onThisPage: "On this page",
      sections: {
        "founder-letter": "Founder Letter",
        introduction: "Introduction",
        "meme-identity": "Meme Identity",
        "brand-hierarchy": "Brand Hierarchy",
        "scan-score": "Scan & Score",
        "axes-confidence": "Axes & Confidence",
        explore: "Explore",
        "hansome-utility": "$HANSOME Utility",
        tokenomics: "Tokenomics",
        treasury: "Treasury Policy",
        liquidity: "Liquidity Policy",
        revenue: "Revenue Strategy",
        roadmap: "Roadmap",
        legacy: "Legacy",
        community: "Community",
        "long-term-vision": "Long-Term Vision",
        faq: "FAQ",
        documents: "Documents",
        changelog: "Changelog",
        language: "Language & Translations",
      },
    },
    backHome: "← hansomealpacas.xyz",
    downloadPdf: "Download Litepaper PDF",
    downloadEconomicModelPdf: "Legacy Economic Model PDF",
    documentsLibrary: {
      heading: "Documents",
      blurb:
        "Official downloadable files served from /docs on this site. Prefer PDF for sharing; Markdown for reading in a text editor. GameFi economic-model files are Legacy documentation.",
      litepaperEn: "Litepaper (English PDF)",
      litepaperZh: "Litepaper (Chinese PDF)",
      economicPdfEn: "Legacy — GameFi Economic Model (English PDF)",
      economicPdfZh: "Legacy — GameFi Economic Model (Chinese PDF)",
      economicMdEn: "Legacy — GameFi Economic Model (English Markdown)",
      economicMdZh: "Legacy — GameFi Economic Model (Chinese Markdown)",
      openInBrowser: "Open",
    },
    hero: {
      eyebrow: "LITEPAPER · HANSOME 2.0",
      title: "HANSOME ALPACAS",
      subtitle:
        "Too Hansome to Be Useful. So we built something useful anyway — meme culture, transparency, discovery, and on-chain tools. No promises we can't keep.",
      meta: [
        { label: "Network", value: "Robinhood Chain" },
        { label: "Total Supply", value: "1,000,000,000 HANSOME" },
        { label: "Tax", value: "0%" },
        { label: "Contract", value: "Immutable, non-mintable" },
      ],
    },
    statusLabels: {
      live: "LIVE",
      inDevelopment: "IN DEVELOPMENT",
      planned: "PLANNED",
      conditional: "CONDITIONAL",
      legacy: "LEGACY",
      exploratory: "EXPLORATORY",
    },
    founderLetter: {
      heading: "Founder Letter",
      paragraphs: [
        "Too Hansome to Be Useful. That was the joke. An alpaca that won the genetic lottery and had absolutely nothing practical to offer. We started HANSOME ALPACAS because that made us laugh — and because meme culture is allowed to be ridiculous before it is allowed to be useful.",
        "HANSOME 2.0 is the next chapter of the same joke: Too Hansome to Be Useful. So we built something useful anyway. Not an enterprise analytics company. Not a whitepaper full of buzzwords. A meme brand that also ships transparency, discovery, and on-chain tools — Scan, Score, and eventually Explore — while keeping the alpaca culture intact.",
        "What we can promise today is still narrower than a hype deck: a fixed, non-mintable supply; an immutable contract; public wallets; and honest status labels. HANSOME Scan and HANSOME Score are IN DEVELOPMENT. Explore is PLANNED. Launch-related work is CONDITIONAL. Genesis NFT / Alpacas vs Cougars sits under LEGACY. We will not describe Scan as production-live just to sound bigger.",
        "This document is the public record of that shift. It says what is real, what is in progress, what is planned, and what is legacy. If HANSOME is still around in a year, we want it to be because a real community stuck with a handsome alpaca that finally learned how to be a little useful — without forgetting it was a meme first.",
        "Thanks for reading this far. Stay Hansome.",
      ],
      signature: "— The HANSOME ALPACAS team",
    },
    introduction: {
      heading: "Introduction / What is HANSOME?",
      paragraphs: [
        "HANSOME ALPACAS is a meme-first project on Robinhood Chain: fixed-supply, zero-tax ERC-20 $HANSOME, trading against ETH through a Uniswap v4 concentrated-liquidity pool. The identity is still the joke — Too Hansome to Be Useful — and the brand is still alpaca meme culture, not a corporate dashboard.",
        "HANSOME 2.0 adds a second layer on top of that meme: transparency, discovery, and on-chain tools. The direction is Meme + Transparency + Discovery + On-chain Tools. Scan and Score are being built so people can inspect structural risk and data completeness without confusing popularity for safety. Explore is planned for category and trending discovery later. None of that replaces the meme — it gives the meme something useful to do.",
        "What already exists on-chain today: immutable, non-mintable $HANSOME; official liquidity (including Titan-locked position #47299); public wallets; and /transparency as the live balance source of truth. What does not exist as a production promise: a finished public scanner product. Status labels in this litepaper are deliberate.",
      ],
      whatIsHansome: {
        heading: "What is HANSOME?",
        paragraphs: [
          "HANSOME ALPACAS (ticker: HANSOME) is a fixed-supply, zero-tax ERC-20 on Robinhood Chain. Its core identity remains meme culture: an extremely handsome alpaca that was never designed as a serious utility product.",
          "Around that token, HANSOME 2.0 is building optional tools — Scan, Score, Explore, and a conditional Launch path — with clear status labels. The token contract itself does not mint utility into existence; tools are separate products with their own maturity. Genesis NFT / Alpacas vs Cougars GameFi is documented under Legacy.",
        ],
      },
    },
    memeIdentity: {
      heading: "Meme Identity",
      slogan: "Too Hansome to Be Useful.",
      tagline: "Too Hansome to Be Useful. So we built something useful anyway.",
      paragraphs: [
        "HANSOME is a meme brand first. The alpaca, the jawline, the uselessness — that is the culture. Tools come second, as a punchline with a purpose: if we are going to be here after the first hype cycle, we might as well ship transparency and discovery that other meme coins usually skip.",
        "We are not repositioning as an enterprise analytics corporation. Score is not a sales pitch for institutional risk desks. It is a hansome way to look at structural on-chain signals, Activity, and Confidence — while keeping the meme voice.",
      ],
      pillars: [
        {
          title: "Meme",
          body: "Culture, jokes, contests, and a mascot people actually want to share. If it stops being funny, the rest does not matter.",
        },
        {
          title: "Transparency",
          body: "Public wallets, verifiable liquidity ops, and /transparency as the live source of truth for balances — not vibes.",
        },
        {
          title: "Discovery",
          body: "Helping people find and contextualize tokens through Explore (PLANNED) and clear Category / Trending labels — without selling safety.",
        },
        {
          title: "On-chain Tools",
          body: "HANSOME Scan & Score (IN DEVELOPMENT): structural signals, Activity, and Confidence — separate axes, honest status.",
        },
      ],
    },
    brandHierarchy: {
      heading: "Brand Hierarchy",
      intro:
        "HANSOME 2.0 is a stack of named products under one meme brand. Each line has a status label. Do not collapse them into “the app is live.”",
      items: [
        {
          name: "HANSOME Scan",
          statusKey: "inDevelopment",
          status: "IN DEVELOPMENT",
          body: "Token inspection surface for structural Score, Activity, and Confidence. Not a production-live scanner product. Internal Week / Month stages are soft planning markers, not delivery promises.",
        },
        {
          name: "HANSOME Score",
          statusKey: "inDevelopment",
          status: "IN DEVELOPMENT",
          body: "0–100 structural risk & transparency heuristic. Not popularity, not price prediction, not a rug/moon oracle. Always shown with Confidence.",
        },
        {
          name: "HANSOME Explore",
          statusKey: "planned",
          status: "PLANNED",
          body: "Discovery UI for categories, tags, and trending — after Scan/Score are stable enough. Not Week-1 scope.",
        },
        {
          name: "HANSOME Launch",
          statusKey: "conditional",
          status: "CONDITIONAL",
          body: "Any launch-related product path depends on tooling maturity, community need, and explicit go decisions. Not a dated promise.",
        },
        {
          name: "Genesis NFT / Alpacas vs Cougars",
          statusKey: "legacy",
          status: "LEGACY",
          body: "Season-1 GameFi and mint flywheel documentation live under Legacy. Preserved for holders and history — not the primary HANSOME 2.0 product narrative.",
        },
      ],
    },
    scanScore: {
      heading: "HANSOME Scan & Score",
      status: "IN DEVELOPMENT",
      paragraphs: [
        "HANSOME Scan is the inspection surface. HANSOME Score is the structural 0–100 output shown inside Scan. Both are IN DEVELOPMENT. This litepaper does not claim a production-live scanner, does not say “available now,” and does not describe users as currently depending on a finished Scan product.",
        "Score measures structural / on-chain risk and transparency signals only. It is not a popularity contest, not volume fame, and not financial advice. Prototype and staging work may exist for internal or limited testing; public maturity is still in development.",
        "Week / Month labels used in internal planning are soft stages for sequencing work — not hard public delivery dates.",
        "A core Scan capability in progress: Uniswap v4 Liquidity & Lock Intelligence — because on Robinhood Chain, “liquidity visible” does not necessarily mean “liquidity understood.”",
      ],
      principlesHeading: "Score principles (non-negotiable)",
      principles: [
        "Small liquidity, few holders, or low volume ≠ automatically “unsafe.”",
        "Liquidity size / slippage is context and warning — ownership / withdrawal risk may affect Score.",
        "Missing data lowers Confidence; it does not invent safety via a fake high Score.",
        "$HANSOME never buys a higher Score. Holdings of HANSOME do not boost another token’s Score.",
        "Category, Trending, and paid placement never affect Score.",
      ],
      v4LockIntelligence: {
        heading: "Uniswap v4 Liquidity & Lock Intelligence",
        status: "IN DEVELOPMENT",
        problem: [
          "Mainstream scanners may provide limited or incomplete visibility into Uniswap v4 positions and third-party lockers on Robinhood Chain. That visibility gap can leave holders looking at a pool TVL number without knowing who can withdraw the position NFT, whether a locker is verified, or when a lock expires.",
          "HANSOME Scan is building tooling aimed at that gap — not as a finished generic product, and not with “first in the world” marketing. Just a handsome attempt to make v4 + locker evidence readable.",
        ],
        capabilitiesHeading: "Planned capabilities (IN DEVELOPMENT)",
        capabilities: [
          "Pool identity and Uniswap v4 position NFT / position id",
          "Position owner (EOA, treasury, locker contract, or other)",
          "Locker name when recognized via an extensible locker registry",
          "Lock status with explicit labels (see below)",
          "Unlock date when verifiable on-chain",
          "Lock transaction evidence (public explorer links when available)",
          "In-range / out-of-range status for concentrated positions",
          "Position liquidity amount as context",
          "Separation of size vs ownership / withdrawal risk in the UI and Score inputs",
        ],
        statusesHeading: "Explicit lock statuses",
        statuses: [
          "LOCKED — VERIFIED ON-CHAIN",
          "UNLOCKED / EOA-CONTROLLED",
          "LOCK DETECTED — EXPIRY UNKNOWN",
          "UNSUPPORTED LOCKER",
          "UNABLE TO DETERMINE",
        ],
        interpretationHeading: "How to read these statuses",
        interpretation: [
          "Unknown ≠ unlocked. “UNABLE TO DETERMINE” and “UNSUPPORTED LOCKER” mean the tool lacks verified evidence — not that someone can pull liquidity tomorrow.",
          "A detected lock ≠ “safe.” Lock without verified conditions, expiry, or ownership clarity is incomplete information. Always show evidence.",
          "Liquidity visible does not necessarily mean liquidity understood. Pool depth alone can be a misleading comfort signal if withdrawal control is opaque.",
        ],
        whyItMatters: [
          "Meme coins live and die on trust theater. Showing a big liquidity number without lock / ownership context is how that theater happens. We’d rather say “we don’t know yet” with a clear status than invent safety.",
          "This is a visibility problem we encountered building on Robinhood Chain with Uniswap v4 and third-party lockers (including Titan). Closing that gap carefully is part of what Scan is for.",
        ],
        scoreRelationshipHeading: "Relationship to HANSOME Score",
        scoreRelationship: [
          "Size ≠ Lock Status ≠ Ownership / Withdrawal Risk ≠ Range Status. Keep them separate in the product.",
          "Small liquidity ≠ unsafe. Large liquidity ≠ safe.",
          "Verified lock status and ownership / withdrawal risk may feed the structural Score (when evidence exists).",
          "Liquidity size remains slippage / depth context and Activity-adjacent warning — not a popularity boost and not an automatic Score penalty for being small.",
          "Missing locker coverage lowers Confidence and may yield UNABLE TO DETERMINE / UNSUPPORTED LOCKER — it does not invent “unlocked” or “safe.”",
        ],
        maturityNote:
          "Status: IN DEVELOPMENT — not production-ready generic multi-token / multi-locker support. A prototype path has detected HANSOME’s Titan-locked Uniswap v4 position #47299 with on-chain evidence; extending that into a general locker registry across tokens is still being built. Soft Week / Month stages only — no hard delivery promise.",
      },
    },
    axesConfidence: {
      heading: "Activity · Trending · Category · Confidence",
      intro:
        "Four discovery axes plus Confidence. They are strictly separate. Mixing them is how meme tools become dishonest.",
      axes: [
        {
          title: "HANSOME Score",
          body: "Structural risk & transparency (0–100). The only axis that is “the Score.”",
        },
        {
          title: "Activity",
          body: "Low / Medium / High trading and holder activity. Informational. Activity is not safety.",
        },
        {
          title: "Trending",
          body: "Relative momentum (PLANNED with Explore). Trending ≠ safer. Organic Trending is never pay-to-rank.",
        },
        {
          title: "Category",
          body: "Taxonomy labels (e.g. Animal Memes, DeFi, Gaming). Category does not affect Score.",
        },
        {
          title: "Confidence",
          body: "Data completeness and sample maturity (shown beside Score). Confidence ≠ Score. New or thinly indexed tokens should show uncertainty here — not a cosmetic high Score.",
        },
      ],
      principlesHeading: "Hard separations",
      principles: [
        "Score ≠ Activity ≠ Trending ≠ Category.",
        "Confidence = data completeness / maturity — not a second popularity meter.",
        "Trending ≠ safer.",
        "Category does not affect Score.",
        "Promoted ≠ organic Trending. Any future paid placement must be labeled Promoted and must never mix into organic Trending or Score.",
        "$HANSOME never buys Score.",
      ],
    },
    explore: {
      heading: "HANSOME Explore",
      status: "PLANNED",
      paragraphs: [
        "Explore is the planned discovery layer: browse by Category / tags, surface Trending with transparent relative-momentum logic, and keep Promoted placements clearly labeled if they ever exist.",
        "Explore depends on Scan/Score stability and taxonomy workflows. It is PLANNED — not shipping as a Week-1 promise, and not described as live in this document.",
        "Until Explore exists, discovery remains informal (community, listings, charts). That is fine. We would rather ship Explore late and honest than early and fake.",
      ],
    },
    hansomeUtility: {
      heading: "$HANSOME Utility",
      paragraphs: [
        "$HANSOME is still a meme token first: fixed supply, 0% tax, immutable contract, Robinhood Chain. There is no staking product and no yield mechanism baked into the token contract.",
        "HANSOME 2.0 utility is ecosystem-level, not a list of invented holder perks. The token anchors the brand, treasury, and liquidity; tools (Scan, Score, Explore) are built around the same culture and transparency standard. This litepaper does not invent new Genesis NFT holder benefits.",
        "If future tool access, community programs, or branded products attach more concrete utility, they will be announced with dates and status labels — not silently implied here.",
      ],
      items: [
        {
          title: "Meme & brand anchor",
          body: "The cultural center of HANSOME ALPACAS — contests, content, and community identity.",
        },
        {
          title: "Treasury & liquidity fuel",
          body: "Official wallets and Uniswap v4 liquidity policy (see Tokenomics, Treasury, Liquidity). Live balances: /transparency.",
        },
        {
          title: "Tools ecosystem (in progress)",
          body: "Scan & Score IN DEVELOPMENT; Explore PLANNED; Launch CONDITIONAL. Utility grows with shipped tools — not with slogans.",
        },
        {
          title: "Legacy GameFi (separate)",
          body: "Genesis / Alpacas vs Cougars economics remain documented under Legacy. They are not the primary 2.0 utility story.",
        },
      ],
    },
    gameplayOverview: {
      heading: "Gameplay Overview (Legacy)",
      opening:
        "LEGACY — HANSOME: Alpacas vs Cougars is more than a collectible NFT project.",
      paragraphs: [
        "Every Genesis NFT has a role inside an on-chain survival game where players compete, survive, and earn rewards.",
        "Players may become:",
      ],
      roles: [
        "🦙 Alpacas — survive, hide, and outlast the hunt.",
        "🐆 Cougars — track, hunt, and eliminate prey.",
      ],
      loopLabel: "Each day, players make strategic decisions through the game's:",
      closing: [
        "Commit Move → Reveal Move → Settlement → Claim Rewards",
        "Different NFT traits and abilities influence gameplay, creating a unique experience for every holder.",
        "This Litepaper provides only a simple overview of the legacy game ecosystem.",
        "For detailed gameplay mechanics, NFT abilities, locations, reward pools, settlement rules, and claiming instructions, please visit the Game section.",
      ],
      imageAlt: "Pixel art of a snarling cougar facing a calm grass-chewing alpaca in a mountain meadow",
      captionTitle: "HANSOME: Alpacas vs Cougars",
      captionLines: [
        "One world.",
        "Two destinies.",
        "🦙 Survive as an Alpaca.",
        "🐆 Hunt as a Cougar.",
        "Every NFT is playable.",
        "Every decision matters.",
      ],
      cta: {
        heading: "Want to learn how the game works?",
        body: "This Litepaper provides only a high-level Legacy overview.",
        bullets: [
          "Daily gameplay loop",
          "NFT abilities",
          "Reward pools",
          "Locations",
          "Hunting mechanics",
          "Settlement rules",
          "Claim rewards",
        ],
        button: "EXPLORE THE GAME",
        href: "/game",
      },
    },
    gamefiEconomicModel: {
      heading: "GameFi Economic Model (Legacy)",
      intro: [
        "LEGACY — HANSOME: Alpacas vs Cougars is a day-settled GameFi economy on Robinhood Chain. Daily rewards are paid from the GameTreasury balance of $HANSOME — they are not newly minted. Outcomes depend on participation, decisions, treasury health, and market conditions. This section does not promise profits or fixed yields.",
        "The full mathematical analysis — emission bands, pool splits, Alpaca vs Cougar economics, game-theory framing, treasury runway, and why the design targets long-term sustainability versus typical P2E — is published as a standalone Legacy report for players and researchers.",
      ],
      highlightsHeading: "What the model explains",
      highlights: [
        "Daily pool Rd = f(G) with implemented step bands (R0 = 400,000 when G ≥ 0.70·G0)",
        "Launch Treasury: initially funded with 30,000,000 HANSOME → starting band 80,000/day; higher bands unlock automatically as Treasury grows (60M / 120M / 210M)",
        "Pool split: Alpaca 80% · Cougar base 10% · Hunting 10%",
        "Conservation: player claims + penalties + unallocated = Rd",
        "Protocol band reference G0 = 300,000,000 (design scale); gross runway illustration G0 / R0 ≈ 750 days at top band (actual life varies with funding, step-downs, sinks, and claims)",
        "Two-sided value: player agency and NFT utility alongside sustainable ecosystem runway",
        "Long-term design: fixed-supply rewards from GameTreasury, step-down emission, progressive treasury expansion without contract upgrades, Alpaca/Cougar mutual demand (no profit guarantees)",
      ],
      disclaimer:
        "Rewards are contingent. Missing Reveal, safe mode (G < Gsafe), or population imbalance can reduce or eliminate a day’s earnings. Not investment advice. Legacy documentation — not the primary HANSOME 2.0 product narrative.",
      linksHeading: "Legacy Economic Model documents",
      links: {
        reportEn: "English report (Markdown)",
        reportZh: "Chinese report (Markdown)",
        pdfEn: "Download PDF (English)",
        pdfZh: "Download PDF (Chinese)",
        game: "Open the game",
      },
      hrefs: {
        reportEn: "/docs/HANSOME_GAME_ECONOMIC_MODEL_EN.md",
        reportZh: "/docs/HANSOME_GAME_ECONOMIC_MODEL_ZH.md",
        pdfEn: "/docs/HANSOME_GAME_ECONOMIC_MODEL_EN.pdf",
        pdfZh: "/docs/HANSOME_GAME_ECONOMIC_MODEL_ZH.pdf",
        game: "https://game.hansomealpacas.xyz/",
      },
    },
    tokenomics: {
      heading: "Tokenomics",
      diagramCenterLabel: "HANSOME",
      legend: {
        treasury: "Treasury",
        liquidity: "Liquidity",
        founder: "Founder",
      },
      totalSupply: {
        heading: "Total Supply",
        value: "1,000,000,000 HANSOME",
        body: "The supply was fixed at deployment and cannot change. There is no mint function in the contract — not for the team, not for an owner, not for anyone.",
      },
      distribution: {
        heading: "Initial Distribution (At Launch)",
        body: "This is how the supply was split across the project's three token-holding wallets on day one — not how much each wallet holds today:",
        rows: [
          { label: "Liquidity", value: "50,000,000 HANSOME (5%)", note: "Deployed into the official Uniswap v4 pool at launch." },
          {
            label: "Treasury",
            value: "900,000,000 HANSOME (90%)",
            note: "Its starting balance, not its current one — see the note below and Treasury Policy for what's happened since.",
          },
          { label: "Founder", value: "50,000,000 HANSOME (5%)", note: "Founder allocation." },
        ],
        footnote:
          "These percentages describe the initial split at launch, not a live snapshot. Current balances move over time — most notably the Treasury's, which decreases as tokens are deployed into official liquidity under the Treasury and Liquidity policies below. A lower Treasury balance almost always means tokens were converted into a public, verifiable liquidity position, not that they were sold. For what every wallet actually holds right now, go to /transparency — that page, not this document, is the live source of truth.",
      },
      whyFixedSupply: {
        heading: "Why fixed supply?",
        body: "A mint function is a standing promise that the rules can change later. Removing it entirely means no one — including the team — can ever dilute holders, no matter how the project evolves. The tradeoff is real: it also means the project can never simply print its way out of a liquidity problem. That constraint is treated as a feature, not a bug, and it directly shapes the Treasury and Liquidity policies below.",
      },
    },
    treasury: {
      heading: "Treasury Policy",
      intro:
        "The Treasury wallet started with the largest single allocation of HANSOME — 90% of supply at launch. Its balance today is lower than that, and keeps changing over time, mainly because deploying tokens into official liquidity is itself a Treasury action (see below). This section describes policy — what the Treasury is for and how it's used. For what it actually holds right now, that's always /transparency, never this document. It's a single, publicly-visible wallet — not yet split into named sub-funds with fixed percentages for each purpose.",
      lines: [
        {
          label: "Liquidity",
          value: "Primary current use",
          detail:
            "Most Treasury deployment to date has gone toward funding and reinforcing the official Uniswap v4 liquidity position. This is the main reason the Treasury's current balance is lower than its initial 90% allocation — those tokens weren't sold, they were converted into a public, verifiable liquidity position (see the Liquidity Wallet on /transparency and the Liquidity Policy below).",
        },
        {
          label: "Community",
          value: "Planned — TODO",
          detail:
            "A dedicated allocation or budget for community incentives has not been finalized. Any future commitment here will be published, not assumed.",
        },
        {
          label: "Development",
          value: "Planned — TODO",
          detail:
            "No formal development sub-budget has been carved out yet. HANSOME 2.0 tooling (Scan, Score, Explore) is the intended product direction those funds would support once a budget is published — not an open-ended promise of spend.",
        },
        {
          label: "Team",
          value: "See Founder allocation",
          detail:
            "The only team-linked allocation is the Founder wallet (50,000,000 HANSOME, 5%). There is no separate, additional team fund inside the Treasury.",
        },
      ],
      transparencyHeading: "Transparency",
      transparencyBody:
        "Every wallet referenced above is public. Addresses and Uniswap v4 pool/position details are listed below; current balances are read live from the contract at /transparency. That page, not this document, is the source of truth for what each wallet holds today — the figures below are each wallet's initial allocation at launch, not a live number.",
      wallets: [
        { title: "Deployment Wallet", purpose: "Contract deployment and technical operations.", allocation: "Initial allocation: 0%" },
        {
          title: "Liquidity Wallet",
          purpose: "Official Uniswap v4 liquidity management.",
          allocation: "Initial LP deposit: 50,000,000 HANSOME + 0.075 ETH",
        },
        {
          title: "Treasury",
          purpose: "Treasury, ecosystem growth, partnerships, future liquidity, marketing and development.",
          allocation: "Initial allocation: 900,000,000 HANSOME (90%) — current balance is lower; see /transparency",
        },
        { title: "Founder Wallet", purpose: "Founder allocation.", allocation: "Initial allocation: 50,000,000 HANSOME (5%)" },
      ],
      viewWallets: "View live wallet addresses & balances →",
    },
    liquidity: {
      heading: "Liquidity Policy",
      concentratedLiquidity: {
        heading: "Concentrated Liquidity",
        body: "HANSOME trades through a Uniswap v4 pool using concentrated liquidity: capital is deployed across a defined price range instead of the full 0-to-infinity curve. This makes each dollar of liquidity work harder inside that range, at the cost of the position becoming fully one-sided if price moves outside it. That tradeoff is deliberate, not accidental — and it means liquidity depth is a policy decision, not a set-and-forget default.",
      },
      longTermStrategy: {
        heading: "Long-Term LP Strategy",
        body: "The current approach favors a small number of well-understood positions over constant micromanagement. The intended long-term shape is a barbell: one tighter position for capital efficiency near the current price, plus at least one wider or full-range position sized as a standing backstop, so a single large trade can never fully exhaust tradeable liquidity in one direction. As of July 2026, that barbell is live — see Liquidity Optimization below for what changed.",
      },
      lpFees: {
        heading: "LP Fees",
        body: "The pool carries a 0.05% swap fee, which accrues to whoever holds the liquidity position — currently the Treasury. These fees are real, on-chain revenue generated independently of any token tax, and the intent is to periodically collect and recycle them back into liquidity rather than let them sit unclaimed.",
      },
      onChainVerification: {
        heading: "On-Chain Verification",
        body: "The official Uniswap v4 LP position (#47299) is locked via TitanLockerManagerV2 until July 15, 2027. That isn't something you have to take our word for — the lock contract and the lock transaction are both public on Blockscout, so anyone can verify it independently.",
        links: [
          {
            href: "https://robinhoodchain.blockscout.com/address/0x26b0654A0756DCd036D4e7215324f3D2Be34D79e",
            label: "View Lock Contract →",
          },
          {
            href: "https://robinhoodchain.blockscout.com/tx/0x8ac188afa59c9bc26626bfec6977fbc25c294003d8761b2e41030ad0aab3bcf3",
            label: "View Lock Transaction →",
          },
        ],
      },
      liquidityOptimization: {
        heading: "Liquidity Optimization (July 2026)",
        body: "In July 2026, the Treasury carried out a liquidity optimization on the official Uniswap v4 pool. The original 365-day locked position (#47299, see On-Chain Verification above) was left completely unchanged — nothing about that lock was touched or unwound. Alongside it, the Treasury added two new, Treasury-owned liquidity positions: a narrow-range position sized to reduce swap slippage near the current price, and a wider-range position held as additional downside protection. Combined, this meaningfully increased the capital backing official liquidity beyond the original locked position alone. This was funded through disclosed Treasury liquidity management, and every step of it is publicly verifiable on-chain.",
      },
      improvedTradingExperience: {
        heading: "Improved Trading Experience",
        body: "Since the optimization above, swap slippage on the official pool has been reduced noticeably at typical trade sizes. Medium and larger trades now execute more efficiently, with less price impact than before. Market depth is better on both sides of the current price, and the overall experience for anyone buying in for the first time is meaningfully smoother than it was.",
      },
      multiplePositions: {
        heading: "Multiple LP Positions",
        body: "A single concentrated position has a hard capacity limit in each direction. Running more than one position — at different ranges, potentially funded from different sources — is the standard way serious concentrated-liquidity operators avoid that limit becoming a single point of failure. As described in Liquidity Optimization above, this is now implemented for HANSOME: the original locked position runs alongside two additional Treasury-owned positions.",
      },
      noReactiveChasing: {
        heading: "Why We Won't Constantly Chase Price With Reactive Liquidity",
        body: "Adding liquidity immediately after every large trade, in direct reaction to that trade, tends to just get consumed by the next large trade — it's a treadmill, not a strategy. Instead, liquidity decisions are meant to be sized ahead of expected activity and tied to durable milestones (like sustained market-cap tiers), not to the most recent headline or the most recent scare.",
      },
    },
    revenue: {
      heading: "Revenue Strategy",
      intro:
        "HANSOME has 0% transaction tax by design, so it doesn't generate revenue the way older “tax token” meme coins did. Funding for liquidity and for HANSOME 2.0 tools has to come from real sources — not from printing more HANSOME. Here's what's running today, what's in development, and what remains exploratory. Nothing below is guaranteed.",
      streams: [
        {
          id: "lp-fees",
          title: "LP Fees",
          statusKey: "active",
          status: "Active",
          body: "The 0.05% Uniswap v4 pool fee is the one revenue source already running today, scaling automatically with trading volume. It's small, it's real, and it's the only item on this list that does not depend on shipping a new product.",
        },
        {
          id: "scan-score-tools",
          title: "Scan & Score ecosystem",
          statusKey: "inDevelopment",
          status: "IN DEVELOPMENT",
          body: "On-chain inspection tools are the product direction of HANSOME 2.0. Any future monetization (if any) will be disclosed separately and must never include paying for a higher Score or organic Trending rank. Status today: in development — not a live revenue line.",
        },
        {
          id: "explore-discovery",
          title: "Explore discovery",
          statusKey: "planned",
          status: "PLANNED",
          body: "If Explore ships, labeled Promoted placements (if ever offered) would be the only paid discovery surface — never mixed into Score or organic Trending. Explore itself remains planned.",
        },
        {
          id: "merchandise",
          title: "Merchandise",
          statusKey: "exploratory",
          status: "Exploratory",
          body: "Apparel, plushies, stickers — a natural fit for the mascot. Nothing has been designed, produced, or sold yet. We'd rather do it right once there's a community big enough to want it.",
        },
        {
          id: "partnerships",
          title: "Partnerships",
          statusKey: "exploratory",
          status: "Exploratory",
          body: "No partnerships, sponsorships, or cross-promotions are assumed. If the right one fits the brand, it will be announced when real — not listed as live here.",
        },
      ],
    },
    roadmap: {
      heading: "Roadmap — HANSOME 2.0",
      intro:
        "Phased roadmap with honest status labels. “Week” and “Month” refer to soft internal sequencing stages for tooling work — not hard public delivery promises. Conditional items require explicit go decisions.",
      phases: [
        {
          phase: "Phase 0",
          title: "Foundation (shipped)",
          statusKey: "completed",
          status: "Completed",
          items: [
            { label: "Deploy fixed-supply, non-mintable, immutable HANSOME contract on Robinhood Chain", done: true },
            { label: "Create the official Uniswap v4 ETH/HANSOME liquidity pool", done: true },
            { label: "Launch the public website, swap interface, and /transparency page", done: true },
            { label: "Lock official Uniswap v4 LP position (#47299) via Titan Locker — unlock ~2027-07-15", done: true },
            { label: "Treasury-led liquidity optimization: multiple positions alongside the locked NFT", done: true },
            { label: "Publish litepaper + Legacy GameFi documentation", done: true },
          ],
        },
        {
          phase: "Phase 1",
          title: "Scan & Score",
          statusKey: "inDevelopment",
          status: "IN DEVELOPMENT",
          items: [
            { label: "HANSOME Scan inspection surface — IN DEVELOPMENT (not production-live)", done: false },
            { label: "HANSOME Score structural heuristic + Confidence — IN DEVELOPMENT", done: false },
            {
              label:
                "Uniswap v4 Liquidity & Lock Intelligence + extensible locker registry — IN DEVELOPMENT (differentiator; not production-ready generic multi-token support)",
              done: false,
            },
            { label: "Keep Score ≠ Activity ≠ Trending ≠ Category separations in product UX", done: false },
            { label: "Internal Week / Month stages for sequencing only — soft markers, not public SLAs", done: false },
          ],
        },
        {
          phase: "Phase 2",
          title: "Explore & taxonomy",
          statusKey: "planned",
          status: "PLANNED",
          items: [
            { label: "Category / tag taxonomy with manual verify workflow — PLANNED", done: false },
            { label: "HANSOME Explore discovery UI — PLANNED (after Scan/Score stability)", done: false },
            { label: "Trending as relative momentum; Promoted never mixed into organic Trending or Score", done: false },
          ],
        },
        {
          phase: "Phase 3",
          title: "Launch path",
          statusKey: "conditional",
          status: "CONDITIONAL",
          items: [
            { label: "HANSOME Launch-related product work — CONDITIONAL on tooling maturity and explicit go decisions", done: false },
            { label: "No fixed listing dates, no price targets, no promised exchange outcomes", done: false },
            { label: "CoinGecko / CoinMarketCap applications remain process items, not roadmap guarantees", done: false },
          ],
        },
        {
          phase: "Legacy",
          title: "Genesis NFT / GameFi",
          statusKey: "legacy",
          status: "LEGACY",
          items: [
            { label: "Alpacas vs Cougars gameplay + GameFi economic model preserved under Legacy", done: true },
            { label: "Mint flywheel documentation preserved under Legacy — not the primary 2.0 narrative", done: true },
          ],
        },
      ],
    },
    legacy: {
      heading: "Legacy: Genesis NFT + GameFi",
      status: "LEGACY",
      intro: [
        "This section preserves Season-1 GameFi material: gameplay overview, the GameFi economic model, and the mint-revenue flywheel. It is LEGACY relative to HANSOME 2.0’s meme + tools direction.",
        "Nothing here invents new NFT holder benefits. For live game mechanics, use the Game surface. For economic math, use the Legacy economic-model documents linked below.",
      ],
    },
    community: {
      heading: "Community",
      paragraphs: [
        "Hype is a spike. Community is a floor. HANSOME would rather keep a hundred people who find the alpaca funny — and who care about honest status labels — than ten thousand who forget the ticker next week.",
        "Telegram is active: meme contests, giveaways, AMAs, and community events. Marketing and KOL work exist to bring in people worth keeping, not to paper over missing products.",
        "HANSOME 2.0 asks the community for the same deal as always: meme culture first, transparency always, and tools that earn trust by shipping with clear IN DEVELOPMENT / PLANNED / CONDITIONAL / LEGACY labels.",
      ],
    },
    sustainableEcosystem: {
      heading: "Mint Flywheel (Legacy)",
      paragraphs: [
        "LEGACY — Building a sustainable GameFi ecosystem was a Season-1 vision around Genesis mint revenue.",
        "Revenue generated from the HANSOME: Alpacas vs Cougars NFT mint was described as reinvested into the HANSOME ecosystem through:",
      ],
      investments: [
        "🎮 Game development",
        "📢 Community events & rewards",
        "🤝 Marketing & partnerships",
        "💧 Ecosystem growth",
      ],
      flywheel: [
        "NFT Mint Revenue",
        "Game Development",
        "More Players",
        "Stronger Community",
        "Ecosystem Growth",
        "Further Development",
      ],
      closing: [
        "This flywheel remains documented for Legacy context. HANSOME 2.0’s primary loop is meme culture → transparency → tools → discovery — not mint-first growth.",
        "A stronger ecosystem still matters. The sequencing and product center of gravity have shifted.",
      ],
    },
    longTermVision: {
      heading: "Long-Term Vision",
      intro:
        "There is no guarantee this works. The shape we want is a loop: meme culture that funds honesty, honesty that makes tools trustworthy, tools that make discovery useful — without pretending Scan is already production-live.",
      lifecycle: [
        { label: "Meme", body: "Alpaca culture people actually share — contests, jokes, identity." },
        { label: "Transparency", body: "Public wallets, verifiable LP ops, /transparency as live truth." },
        { label: "Tools", body: "Scan & Score in development — structural signals + Confidence." },
        { label: "Discovery", body: "Explore planned — Category, Trending, labeled Promoted only if ever paid." },
        { label: "Community", body: "People who stay for the culture and the honesty, not just the chart." },
        { label: "Treasury", body: "LP fees and future real revenue reinforce liquidity on purpose — not by printing." },
      ],
      loopLabel: "The Loop",
      closing:
        "Today HANSOME sits early in that loop: strong meme identity, real on-chain transparency, tools in development, Explore planned, Launch conditional, GameFi under Legacy. This document will be updated as statuses change — including admitting when something slips.",
    },
    faq: {
      heading: "FAQ",
      items: [
        {
          question: "What is HANSOME 2.0?",
          answer:
            "The same meme brand — Too Hansome to Be Useful — plus a tools direction: transparency, discovery, and on-chain Scan/Score (IN DEVELOPMENT), Explore (PLANNED), and Launch (CONDITIONAL). Genesis GameFi is Legacy.",
        },
        {
          question: "Is HANSOME Scan live / available now?",
          answer:
            "No — not as a production-live product in this litepaper’s language. HANSOME Scan and HANSOME Score are IN DEVELOPMENT. Do not read prototype or staging work as a finished public scanner. We avoid phrases like “available now,” “live scanner,” or “users can currently…” for Scan/Score.",
        },
        {
          question: "What does HANSOME Score measure?",
          answer:
            "Structural risk and transparency signals (0–100). It is not popularity, not price prediction, and not a rug/moon oracle. Always read it with Confidence (data completeness). Score ≠ Activity ≠ Trending ≠ Category.",
        },
        {
          question: "Does Category or Trending change Score?",
          answer:
            "No. Category never affects Score. Trending is not safety. Promoted placements (if any, in the future) must stay labeled and must never mix into organic Trending or Score. $HANSOME never buys Score.",
        },
        {
          question: "Does small liquidity or low volume mean a token is unsafe?",
          answer:
            "No. Small liquidity, few holders, or low volume are not automatic “unsafe” Score outcomes. Size/slippage is context; ownership/withdrawal risk is the structural liquidity concern that may affect Score. Uncertainty belongs in Confidence.",
        },
        {
          question: "What is Uniswap v4 Liquidity & Lock Intelligence?",
          answer:
            "An IN DEVELOPMENT Scan capability aimed at a visibility gap: mainstream scanners may give limited or incomplete Uniswap v4 + third-party locker visibility on Robinhood Chain. Planned outputs include pool/position identity, owner, locker name, explicit lock statuses (LOCKED—VERIFIED ON-CHAIN, UNLOCKED/EOA-CONTROLLED, LOCK DETECTED—EXPIRY UNKNOWN, UNSUPPORTED LOCKER, UNABLE TO DETERMINE), unlock date, lock tx evidence, range status, and size vs withdrawal risk. Unknown ≠ unlocked; a detected lock ≠ safe without verified conditions. Prototype work has detected HANSOME Titan #47299; generic multi-token/locker support is still being built — not production-ready.",
        },
        {
          question: "Why is the Treasury balance lower than the stated 90%?",
          answer:
            "Because 90% describes the initial allocation at launch, not a fixed balance. Deploying Treasury tokens into the official Uniswap v4 liquidity position is a normal, disclosed part of the Liquidity Policy — not a sale. The live number is always at /transparency.",
        },
        {
          question: "What happens if liquidity becomes one-sided?",
          answer:
            "Concentrated liquidity positions can become fully one-sided if price moves far enough — expected behavior, not a malfunction. HANSOME now runs multiple positions (original Titan-locked #47299 plus additional Treasury-owned ranges) as a barbell backstop. Risk remains real and openly acknowledged; see Liquidity Policy.",
        },
        {
          question: "Why 0% tax and an immutable contract?",
          answer:
            "0% tax means trades settle as quoted with no skim. Immutability with no mint, blacklist, or admin key makes “we can’t cheat the supply rules” a structural fact. Problems get solved with treasury and liquidity policy — and with shipping tools honestly — not by redeploying a new token.",
        },
        {
          question: "Where did the game / Genesis NFT story go?",
          answer:
            "Under Legacy in this litepaper. Gameplay, GameFi economics, and the mint flywheel are preserved there with a LEGACY label. HANSOME 2.0’s primary narrative is meme + tools.",
        },
      ],
    },
    changelog: {
      heading: "Changelog",
      intro: "A record of this document's own revisions — not the whole project's history, just this litepaper.",
      entries: [
        {
          version: "v2.0",
          date: "July 2026",
          changes: [
            "HANSOME 2.0 rewrite: meme identity core (“Too Hansome to Be Useful” / “…So we built something useful anyway”), brand hierarchy with status labels, Scan & Score (IN DEVELOPMENT), axes + Confidence separations, Explore (PLANNED), $HANSOME utility, phased roadmap with Conditional Launch, Legacy section for Genesis + GameFi + mint flywheel.",
            "Added Uniswap v4 Liquidity & Lock Intelligence under Scan & Score (IN DEVELOPMENT): visibility-gap framing, planned capabilities, explicit lock statuses, Score relationship (size ≠ lock ≠ ownership/withdrawal ≠ range), Titan #47299 prototype note, roadmap differentiator + FAQ.",
            "Revenue strategy reframed around ecosystem tools; Documents relabel GameFi economic model as Legacy; FAQ Score disclaimers; closing disclaimer strengthened.",
            "Preserved verified Tokenomics / Treasury / Liquidity facts (1B supply, 0% tax, non-mintable, Robinhood, 90/5/5, wallets, Uniswap v4, Titan #47299 unlock ~2027-07-15, /transparency for live balances). Fixed stale “single position” FAQ language.",
          ],
        },
        {
          version: "v1.7.1",
          date: "July 2026",
          changes: [
            "Expanded the GameFi Economic Model report with a long-term sustainability section (P2E comparison, fixed supply, treasury-gated emission, player–ecosystem alignment, Alpaca/Cougar two-sided economy).",
          ],
        },
        {
          version: "v1.7",
          date: "July 2026",
          changes: [
            "Added a GameFi Economic Model section with links to the bilingual mathematical analysis report and PDFs (emission bands, pool splits, sustainability, two-sided value).",
          ],
        },
        {
          version: "v1.6",
          date: "July 2026",
          changes: [
            "Added a Gameplay Overview section with an Alpacas vs Cougars illustration and a CTA to the Game page for full mechanics.",
            "Added a Building a Sustainable Ecosystem section describing mint-revenue reinvestment and the ecosystem growth flywheel.",
          ],
        },
        {
          version: "v1.5",
          date: "July 2026",
          changes: [
            "Completed a Treasury-led liquidity optimization on the official Uniswap v4 pool: added two new Treasury-owned positions — a narrow-range position for lower swap slippage and a wide-range position for additional downside protection — while leaving the original 365-day locked position (#47299) completely unchanged.",
            "Updated the Liquidity Policy section to reflect that the barbell liquidity strategy, previously described as planned, is now live across three Treasury-linked positions.",
            "Added notes on the improved trading experience following the optimization: reduced swap slippage, more efficient execution for medium and larger trades, and better market depth.",
            "Added notes on recent infrastructure improvements: swap infrastructure, gas-fee handling on Robinhood Chain, transaction reliability, and internal liquidity management tooling.",
            "Expanded the Community section to reflect AMA sessions, KOL collaborations, and ongoing marketing campaigns alongside existing meme contests, giveaways, and community events.",
            "Expanded the Transparency pillar in Core Philosophy to explicitly note that all liquidity operations are performed on-chain and are publicly verifiable, and that the project prioritizes long-term sustainability over short-term hype.",
          ],
        },
        {
          version: "v1.4",
          date: "July 2026",
          changes: [
            "Officially listed on GeckoTerminal.",
            "Officially listed on DexScreener.",
            "Submitted a CoinGecko listing application (pending review).",
            "Submitted a CoinMarketCap listing application (pending review).",
            "Officially locked the Uniswap v4 LP position (#47299) for 365 days via Titan Locker, unlocking July 2027 — a concrete, on-chain demonstration of long-term commitment to liquidity.",
            "Updated the Roadmap's liquidity plans: rather than committing to a fixed second position, liquidity depth is now monitored on an ongoing basis, with more added only if trading volume and community growth genuinely call for it.",
            "Updated the Roadmap to reflect current milestones.",
            "Updated the Community section to reflect the active Telegram community, regular meme contests, giveaways, and ongoing community events.",
            "Minor wording improvements and documentation updates throughout the litepaper.",
          ],
        },
        {
          version: "v1.3",
          date: "July 2026",
          changes: [
            "Clarified Tokenomics and Treasury Policy: the 90% Treasury figure is the initial allocation at launch, not a live balance. Added explicit language that Treasury tokens are expected to move into official liquidity over time, and that a decreasing Treasury balance means tokens were converted into a public liquidity position, not sold.",
            "Removed hardcoded current-balance language from the Litepaper; every wallet section now points to /transparency as the live source of truth instead of stating a number here.",
            "Added a FAQ entry: \"Why is the Treasury balance lower than the stated 90%?\"",
            "/transparency itself now reads each official wallet's current HANSOME balance live from the contract, shown alongside its initial allocation.",
          ],
        },
        {
          version: "v1.2",
          date: "July 2026",
          changes: [
            "Realigned the Founder Letter, Introduction, Vision, Core Philosophy, Revenue Strategy, Roadmap, Community, and Long-Term Vision sections with the project's actual direction: HANSOME starts as a meme coin, but the token is meant to be the beginning of a real alpaca brand — content, community events, meme contests, merch, and partnerships if the community keeps growing — not the end of the story.",
            "Added a \"The Token Is the Start\" pillar to Core Philosophy and new FAQ entries covering merch, community events, partnerships, and what HANSOME actually does today.",
          ],
        },
        {
          version: "v1.1",
          date: "July 2026",
          changes: [
            "Added bilingual support (English / Traditional Chinese) with a single shared page and language switch.",
            "Added the Founder Letter, Changelog, and Language & Translations sections.",
            "Added downloadable PDF export in both languages.",
          ],
        },
        {
          version: "v1.0",
          date: "July 2026",
          changes: [
            "Initial publication: Introduction, Vision, Core Philosophy, Tokenomics, Treasury Policy, Liquidity Policy, Revenue Strategy, Roadmap, Community, Long-Term Vision, and FAQ.",
          ],
        },
      ],
    },
    language: {
      heading: "Language & Translations",
      body: "This document is available in English and Chinese. The Chinese version is written by hand to read naturally, not run through machine translation — if you spot a place where the meaning drifts between the two versions, treat the English version as the reference and let us know. Additional languages may be added later; the structure of this document is built so that doing so doesn't require rebuilding the page.",
    },
    closing: {
      note: "This document reflects HANSOME ALPACAS as of publication and will be revised as statuses change. It is not financial advice. HANSOME Score / Scan (when available) are informational heuristics — not investment recommendations, popularity ranks, or guarantees of safety. Crypto is volatile. DYOR. Status labels in this litepaper (IN DEVELOPMENT, PLANNED, CONDITIONAL, LEGACY) override marketing shorthand.",
      home: "Home",
      transparency: "Transparency",
      swap: "Swap",
    },
},
};
