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
  footer: {
    tagline: "Too handsome to be useful.",
    memeLovers: "Made for meme lovers.",
    notFinancialAdvice: "Not financial advice.",
    stayHansome: "Stay Hansome. 🦙",
    builtOn: "Built on Robinhood Chain",
    explorer: "Explorer",
    transparency: "Transparency",
    litepaper: "Litepaper",
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
        "The HANSOME ALPACAS litepaper: founder letter, vision, tokenomics, treasury policy, liquidity policy, revenue strategy, roadmap, and FAQ — what's true today, and honestly, where we're hoping to take this handsome alpaca next.",
    },
    nav: {
      onThisPage: "On this page",
      sections: {
        "founder-letter": "Founder Letter",
        introduction: "Introduction",
        vision: "Vision",
        philosophy: "Core Philosophy",
        tokenomics: "Tokenomics",
        treasury: "Treasury Policy",
        liquidity: "Liquidity Policy",
        revenue: "Revenue Strategy",
        roadmap: "Roadmap",
        community: "Community",
        "long-term-vision": "Long-Term Vision",
        faq: "FAQ",
        changelog: "Changelog",
        language: "Language & Translations",
      },
    },
    backHome: "← hansomealpacas.xyz",
    downloadPdf: "Download PDF",
    hero: {
      eyebrow: "LITEPAPER",
      title: "HANSOME ALPACAS",
      subtitle:
        "A public record of what this project is, what it isn't, and where we're hoping to take it — without promises we can't keep.",
      meta: [
        { label: "Network", value: "Robinhood Chain" },
        { label: "Total Supply", value: "1,000,000,000 HANSOME" },
        { label: "Tax", value: "0%" },
        { label: "Contract", value: "Immutable, non-mintable" },
      ],
    },
    statusLabels: {
      live: "Live",
      planned: "Planned",
      exploratory: "Exploratory",
    },
    founderLetter: {
      heading: "Founder Letter",
      paragraphs: [
        "We didn't start HANSOME ALPACAS because we had a product. We started it because \"an alpaca that won the genetic lottery and has absolutely nothing to show for it\" made us laugh, and we figured it might make other people laugh too. That part hasn't changed. The token is the joke — but it was always meant to be the beginning of something, not the whole thing.",
        "Here's the honest version of the plan: HANSOME starts as a meme coin. If enough people actually stick around because they think a stupidly handsome alpaca is funny, we want to grow this into a real brand — original content, community events, meme contests, merch, maybe partnerships somewhere down the line. Nothing on that list exists yet. We're telling you because it's true, not because we're ready to ship any of it tomorrow.",
        "What we can promise today is narrower than that, and a lot more boring: a fixed supply that can never be minted again, a contract that can't be changed by us or anyone else, and a public paper trail for every wallet that touches this token. We can't promise you a hoodie. We can promise you a contract we can't cheat with, and that any real promise we do make will show up in this document, dated — not just floated in a group chat and forgotten.",
        "This document is the closest thing we have to a plan. It says what's real today, what we're actually hoping to build if this community keeps growing, and where the line between those two things sits. Where we don't know something yet, we've tried to say so instead of filling the gap with confidence we don't have. If HANSOME is still around in a year, we'd rather it be because a real community decided the alpaca — and whatever we managed to build around it — was worth sticking around for, not because we oversold it at the start.",
        "Thanks for reading this far. That already puts you ahead of most people who ape into a meme coin.",
      ],
      signature: "— The HANSOME ALPACAS team",
    },
    introduction: {
      heading: "Introduction",
      paragraphs: [
        "HANSOME ALPACAS started as a meme coin — one extremely handsome alpaca, one ticker, zero marketable skills — trading on Robinhood Chain against ETH through a Uniswap v4 concentrated-liquidity pool. There's no product behind it today, and we're not going to pretend otherwise.",
        "But the token was never meant to be the whole story. If the community around HANSOME keeps growing, the plan is to grow the brand right along with it: original content, community-run events, meme contests, merch (apparel, plushies, stickers — the usual suspects), and partnerships if the right ones show up. None of that exists yet. This document says so plainly, instead of dressing up a wishlist as a roadmap.",
        "What does exist today: a fixed, non-mintable supply, an immutable contract with no owner privileges, and a public record of every wallet that touches the token. This document exists to state plainly what is true today, what is aspirational, and where the line between the two sits — so that trust in this project is built on record, not narrative.",
      ],
      whatIsHansome: {
        heading: "What is HANSOME?",
        paragraphs: [
          "HANSOME ALPACAS (ticker: HANSOME) is a fixed-supply, zero-tax ERC-20 token deployed on Robinhood Chain. Its only stated identity is the joke it was built on: an alpaca that is extremely handsome and, by design, extremely useless.",
          "There is no staking product, no game, no yield mechanism, and no claim of future utility baked into the token contract — and there won't be, without a clear, separate announcement. That's a statement about the contract, not about our ambitions for the brand. For where we'd actually like this to go, see Vision below.",
        ],
      },
    },
    vision: {
      heading: "Vision",
      paragraphs: [
        "Most meme coins are built to spike and fade. We'd rather build the version that's still here — and still growing — after the first hype cycle burns out, even if that means moving slower and yelling less about it.",
        "Here's the honest version of where we want this to go: HANSOME starts as a meme coin, but the token is the beginning, not the destination. If a real community forms around this ridiculous, handsome alpaca, the plan is to turn that into an actual brand — original content, community-driven events, meme contests, merch, and partnerships if the right ones come along. Not a metaverse. Not a \"utility token\" with a whitepaper full of buzzwords. Just an alpaca worth following, in Web3 and outside of it.",
        "None of that requires a specific price, market cap, or exchange listing to happen — it requires people who actually want to be here. So the order of operations is: a small, real community first; a treasury that's managed conservatively and transparently second; and a brand built on top of both, once there's actually something worth building on.",
      ],
    },
    philosophy: {
      heading: "Core Philosophy",
      pillars: [
        {
          title: "Community First",
          body: "There was no presale and no private allocation sold to outside investors. The people who hold HANSOME today got it the same way anyone else could — by buying it on the open market.",
        },
        {
          title: "The Token Is the Start",
          body: "HANSOME launched as a meme coin, and today, that's still all it is — we're not claiming otherwise. But it's not where we're hoping to stop. If the community keeps growing, the intention is to build a real alpaca brand on top of it: content, events, merch, partnerships. That's a stated direction, not a promise with a delivery date.",
        },
        {
          title: "0% Tax",
          body: "Every buy and sell settles at the full quoted amount. There is no hidden fee redirected to a wallet, no \"auto-liquidity\" skim, and no mechanism inside the token contract that takes a cut of your trade.",
        },
        {
          title: "Immutable Contract",
          body: "The HANSOME contract has no owner functions: no mint, no blacklist, no pause, no ability to change the tax, and no admin key that can alter behavior after deployment. What was deployed is permanently what exists.",
        },
        {
          title: "Transparency",
          body: "All four wallets involved in this project — Deployment, Liquidity, Treasury, and Founder — are public and viewable on-chain at any time. See the Treasury Policy section and the live /transparency page for current addresses and balances. Official wallets, treasury activity, liquidity information, and other transparency data are kept on that page, updated from on-chain information whenever possible. Every liquidity operation the Treasury carries out — including the July 2026 liquidity optimization described in the Liquidity Policy section — happens through public transactions anyone can verify, and the original locked position has stayed completely untouched through all of them. Long-term sustainability, not short-term hype, is what those decisions are made for.",
        },
        {
          title: "Long-Term Thinking",
          body: "Decisions about liquidity and treasury spending are made on a deliberate, rules-based basis rather than reacting to whatever happened on Twitter that day. Section by section, this document explains what those rules currently are.",
        },
      ],
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
            "No development budget has been carved out yet, since there is no product roadmap to fund beyond the core token and site. This will be revisited if that changes.",
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
        body: "In July 2026, the Treasury carried out a liquidity optimization on the official Uniswap v4 pool. The original 365-day locked position (#47299, see On-Chain Verification above) was left completely unchanged — nothing about that lock was touched or unwound. Alongside it, the Treasury added two new, Treasury-owned liquidity positions: a narrow-range position sized to reduce swap slippage near the current price, and a wider-range position held as additional downside protection. Combined, official liquidity across all positions now exceeds $10,000. This was funded through disclosed Treasury liquidity management, and every step of it is publicly verifiable on-chain.",
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
        "HANSOME has 0% transaction tax by design, so it doesn't generate revenue the way older \"tax token\" meme coins did. Any future funding for liquidity, or for actually building the brand we talk about in Vision, has to come from somewhere real — not from printing more HANSOME. Here's what's actually running today, and what we'd like to get running if things keep growing. Nothing below is guaranteed.",
      streams: [
        {
          id: "lp-fees",
          title: "LP Fees",
          statusKey: "active",
          status: "Active",
          body: "The 0.05% Uniswap v4 pool fee is the one revenue source already running today, scaling automatically with trading volume. It's small, it's real, and it's the only thing on this list we didn't have to wait on.",
        },
        {
          id: "merchandise",
          title: "Merchandise",
          statusKey: "exploratory",
          status: "Exploratory",
          body: "Apparel, plushies, stickers — merch is a pretty natural fit for a mascot this handsome, and it's part of the actual long-term plan, not just a placeholder line. Nothing has been designed, produced, or sold yet. We'd rather do it right once there's a community big enough to actually want it than rush out a hoodie nobody asked for.",
        },
        {
          id: "partnerships",
          title: "Partnerships",
          statusKey: "exploratory",
          status: "Exploratory",
          body: "No partnerships, sponsorships, or cross-promotions exist right now. If the right one comes along — something that actually fits the brand instead of just paying for a shoutout — we'll take it seriously and announce it once it's real. Nothing here yet.",
        },
        {
          id: "ecosystem-products",
          title: "Future Ecosystem Products",
          statusKey: "exploratory",
          status: "Exploratory",
          body: "No additional products (tools, collabs, drops, etc.) are currently planned or in development. As the brand side of this grows — content, community events, meme contests — some of that may eventually turn into something monetizable. It hasn't yet, and this category stays intentionally open rather than filled with speculative feature ideas.",
        },
      ],
    },
    roadmap: {
      heading: "Roadmap",
      phases: [
        {
          phase: "Phase 1",
          title: "Foundation",
          statusKey: "completed",
          status: "Completed",
          items: [
            { label: "Deploy fixed-supply, non-mintable, immutable HANSOME contract", done: true },
            { label: "Create the official Uniswap v4 ETH/HANSOME liquidity pool", done: true },
            { label: "Launch the public website, swap interface, and /transparency page", done: true },
            { label: "Publish this litepaper", done: true },
          ],
        },
        {
          phase: "Phase 2",
          title: "Stabilize & Listen",
          statusKey: "inProgress",
          status: "In Progress",
          items: [
            { label: "Get discovered on DEX aggregators — officially listed on GeckoTerminal and DexScreener", done: true },
            {
              label:
                "Lock the official Uniswap v4 LP position (#47299) for 365 days via Titan Locker, unlocking July 2027 — a concrete, on-chain commitment to long-term liquidity, verifiable on /transparency",
              done: true,
            },
            {
              label:
                "Complete a Treasury-led liquidity optimization on the official Uniswap v4 pool, adding two new Treasury-owned positions alongside the original locked position (see Liquidity Policy)",
              done: true,
            },
            { label: "Improve swap infrastructure and gas-fee handling on Robinhood Chain for more reliable transactions", done: true },
            { label: "Build internal tooling to support ongoing Treasury liquidity management", done: true },
            { label: "Continue making incremental improvements to the website and overall trading experience", done: false },
            { label: "CoinGecko listing application submitted — pending review", done: false },
            { label: "CoinMarketCap listing application submitted — pending review", done: false },
            { label: "Begin periodic LP fee collection and recycling", done: false },
            {
              label:
                "Continue monitoring market conditions and liquidity depth — additional liquidity may be added in the future if trading volume and community growth genuinely require it",
              done: false,
            },
            { label: "Continue focusing on building the HANSOME brand instead of short-term price targets", done: false },
            { label: "Continue growing the early community around the brand", done: false },
          ],
        },
        {
          phase: "Phase 3",
          title: "Sustain & Grow the Brand",
          statusKey: "future",
          status: "Future",
          items: [
            { label: "Evaluate real, disclosed revenue sources (see Revenue Strategy) as they materialize", done: false },
            { label: "Formalize a rules-based, milestone-tied liquidity top-up schedule", done: false },
            { label: "Explore giving the community a real voice in treasury/liquidity decisions", done: false },
            {
              label: "Start turning the brand into something beyond a chart — content, community events, meme contests — if the community is actually here for it",
              done: false,
            },
            {
              label: "Explore merch (apparel, plushies, stickers) and partnerships once there's a real community to build them for",
              done: false,
            },
            {
              label: "No fixed dates, no promised exchange listings, no price targets — this phase is a direction, not a contract",
              done: false,
            },
          ],
        },
      ],
    },
    community: {
      heading: "Community",
      paragraphs: [
        "Hype is a spike. Community is a floor. A hype cycle can bring a lot of attention very quickly and take all of it away just as fast, leaving nothing behind. A community — even a small one — is what's still around to care the day after the chart stops moving.",
        "This project would rather have a hundred people who actually find the mascot funny and stick around than ten thousand people who forget the ticker by next week. Every policy in this document — the treasury discipline, the liquidity approach, being straight about what's real versus what's just a direction — is really in service of one goal: giving a real community, and eventually a real brand built with that community, something worth being part of.",
        "That's not just an intention anymore. There's an active Telegram community already up and running, growing organically rather than through paid pushes. We run regular meme contests, giveaways, AMA sessions, and community events for the people who actually show up, and we're starting to work with KOLs and run broader marketing campaigns to bring in people worth keeping around. Community participation is quickly becoming one of this project's biggest priorities, right alongside treasury and liquidity discipline.",
      ],
    },
    longTermVision: {
      heading: "Long-Term Vision",
      intro:
        "There is no guarantee this works. But the shape we're hoping HANSOME grows into looks like a loop, not a straight line — starting from a meme coin, and, if it goes well, ending up somewhere much bigger than one. Each stage feeds the next:",
      lifecycle: [
        { label: "Community", body: "People who actually engage because they think the alpaca's funny — not just spectators watching a chart." },
        { label: "Brand", body: "A recognizable alpaca identity people actually want to share — memes, content, an aesthetic worth being part of." },
        {
          label: "Products",
          body: "Real things the brand can support once there's an audience for them — merch (apparel, plushies, stickers), community events, meme contests, maybe collaborations (see Revenue Strategy).",
        },
        { label: "Revenue", body: "Actual income from those products, sponsorships, and from LP fees — not speculation." },
        { label: "Treasury", body: "That revenue accumulates transparently, publicly, on-chain." },
        { label: "Liquidity", body: "Treasury funds reinforce and diversify liquidity on a deliberate schedule." },
      ],
      loopLabel: "The Loop",
      closing:
        "Today, HANSOME is at the very start of this loop — mostly \"Community\" and a little bit of \"Brand,\" with nothing yet in \"Products\" or \"Revenue.\" That's not a failure to hide, it's just an honest snapshot of a project that's still mostly a really handsome alpaca and the people who think that's funny. This document gets revisited and updated as that changes — including admitting it if it doesn't.",
    },
    faq: {
      heading: "FAQ",
      items: [
        {
          question: "What does HANSOME actually do today?",
          answer:
            "Honestly? It's an extremely handsome alpaca with a fixed supply and an immutable contract. That's it, today. Anything beyond that — content, events, merch, partnerships — is covered in Vision and Long-Term Vision above as direction, not as something live right now.",
        },
        {
          question: "Will there be merch, community events, or partnerships?",
          answer:
            "Nothing is live yet. But that's genuinely the plan if the community keeps growing — think original content, community-run events, meme contests, and eventually merch (apparel, plushies, stickers) and partnerships if the right ones show up. No dates, no guarantees. It happens if you all make it worth building.",
        },
        {
          question: "Why is the Treasury balance lower than the stated 90%?",
          answer:
            "Because 90% describes the initial allocation at launch, not a fixed balance. Deploying Treasury tokens into the official Uniswap v4 liquidity position is a normal, disclosed part of the Liquidity Policy — not a sale. So the Treasury's balance is expected to trend down over time as more of it becomes liquidity instead of sitting untouched in that wallet. The live number, right now, is always at /transparency — this document only describes the policy behind why it moves.",
        },
        {
          question: "Why 0% tax?",
          answer:
            "A transaction tax is a standing mechanism that redirects part of every trade somewhere — usually to a wallet the team controls. Removing it entirely means every trade settles exactly as quoted, with nothing skimmed, and removes an entire category of trust question before it can even come up.",
        },
        {
          question: "Why immutable?",
          answer:
            "An upgradeable or owner-controlled contract is a promise that the current rules will stay the current rules, backed by nothing but intent. An immutable contract with no mint, no blacklist, and no admin key makes that promise structurally true instead of just stated — at the cost of never being able to patch anything later, which is a tradeoff made deliberately.",
        },
        {
          question: "What happens if liquidity becomes one-sided?",
          answer:
            "Concentrated liquidity positions can become fully one-sided if price moves far enough in one direction — that's expected behavior, not a malfunction. When it happens, that specific position stops providing depth in that direction until it's rebalanced or supplemented. The Liquidity Policy section above describes the standing-backstop approach planned to keep this from meaning \"no one can trade\" — but as of today, a single position is live, and this risk is real and openly acknowledged.",
        },
        {
          question: "Why not deploy a new token contract?",
          answer:
            "Because the immutability of the current contract is itself the trust feature. Deploying a new contract to \"fix\" a problem would mean abandoning the one guarantee — no mint, no owner control, nothing can change — that this whole document is built around. Problems get solved with treasury and liquidity policy, not by starting over.",
        },
      ],
    },
    changelog: {
      heading: "Changelog",
      intro: "A record of this document's own revisions — not the whole project's history, just this litepaper.",
      entries: [
        {
          version: "v1.5",
          date: "July 2026",
          changes: [
            "Completed a Treasury-led liquidity optimization on the official Uniswap v4 pool: added two new Treasury-owned positions — a narrow-range position for lower swap slippage and a wide-range position for additional downside protection — while leaving the original 365-day locked position (#47299) completely unchanged.",
            "Updated the Liquidity Policy section to reflect that the barbell liquidity strategy, previously described as planned, is now live, with official liquidity across all positions exceeding $10,000.",
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
      body: "This document is available in English and Traditional Chinese. The Traditional Chinese version is written by hand to read naturally, not run through machine translation — if you spot a place where the meaning drifts between the two versions, treat the English version as the reference and let us know. Additional languages may be added later; the structure of this document is built so that doing so doesn't require rebuilding the page.",
    },
    closing: {
      note: "This document reflects the state of HANSOME ALPACAS as of publication and will be revised as the project changes. It is not financial advice.",
      home: "Home",
      transparency: "Transparency",
      swap: "Swap",
    },
  },
};
