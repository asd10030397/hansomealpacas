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
    followX: "Follow on X",
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
      { label: "LIQUIDITY", value: "Locked", secondary: "Planned" },
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
        "The HANSOME ALPACAS litepaper: founder letter, tokenomics, treasury policy, liquidity policy, revenue strategy, roadmap, and FAQ — grounded in what's actually true today.",
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
        "A public record of what this project is, what it isn't, and how it intends to grow — without promises it can't keep.",
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
        "We didn't start HANSOME ALPACAS because we had a product. We started it because \"an alpaca that won the genetic lottery and has absolutely nothing to show for it\" made us laugh, and we figured it might make other people laugh too. That's still the whole premise. We're not going to dress it up as more than that.",
        "What we can promise is narrower, and more boring, than most launches: a fixed supply that cannot be minted again, a contract that cannot be changed by us or anyone else, and a public paper trail for every wallet that touches this token. Not because we're extraordinarily virtuous, but because removing our own ability to break those promises later seemed like the only way to make them actually mean something.",
        "This document is the closest thing we have to a plan. It says what's real today, what we intend to do next, and what's still just a direction we're pointing in. Where we don't know something yet, we've tried to say so instead of filling the gap with confidence we don't have. If HANSOME is still around in a year, we'd rather it be because a real community decided it was worth sticking around for — not because we oversold it at the start.",
        "Thanks for reading this far. That already puts you ahead of most people who ape into a meme coin.",
      ],
      signature: "— The HANSOME ALPACAS team",
    },
    introduction: {
      heading: "Introduction",
      paragraphs: [
        "HANSOME ALPACAS is a meme coin on Robinhood Chain, trading against ETH through a Uniswap v4 concentrated-liquidity pool. It has no product to sell you, no utility to promise, and no roadmap dressed up as a business plan.",
        "What it does have is a fixed, non-mintable supply, an immutable contract with no owner privileges, and a public record of every wallet that touches the token. This document exists to state plainly what is true today, what is aspirational, and where the line between the two sits — so that trust in this project is built on record, not narrative.",
      ],
      whatIsHansome: {
        heading: "What is HANSOME?",
        paragraphs: [
          "HANSOME ALPACAS (ticker: HANSOME) is a fixed-supply, zero-tax ERC-20 token deployed on Robinhood Chain. Its only stated identity is the joke it was built on: an alpaca that is extremely handsome and, by design, extremely useless.",
          "There is no staking product, no game, no yield mechanism, and no claim of future utility baked into the token contract. If any of that changes, it will be a separate, clearly-labeled addition — never retrofitted into this document as if it were always the plan.",
        ],
      },
    },
    vision: {
      heading: "Vision",
      paragraphs: [
        "Most meme coins are built to spike and fade. This one is built to still exist in a form worth caring about after the first hype cycle ends — even if that means growing slower and with less noise.",
        "The goal is not a specific price, market cap, or exchange listing. The goal is a small, real community around a genuinely funny mascot, a treasury that is managed conservatively and transparently, and a liquidity policy that doesn't require anyone to trust a promise instead of a receipt.",
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
          title: "0% Tax",
          body: "Every buy and sell settles at the full quoted amount. There is no hidden fee redirected to a wallet, no \"auto-liquidity\" skim, and no mechanism inside the token contract that takes a cut of your trade.",
        },
        {
          title: "Immutable Contract",
          body: "The HANSOME contract has no owner functions: no mint, no blacklist, no pause, no ability to change the tax, and no admin key that can alter behavior after deployment. What was deployed is permanently what exists.",
        },
        {
          title: "Transparency",
          body: "All four wallets involved in this project — Deployment, Liquidity, Treasury, and Founder — are public and viewable on-chain at any time. See the Treasury Policy section and the live /transparency page for current addresses and balances.",
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
        heading: "Distribution",
        body: "The stated allocation across the project's three token-holding wallets is:",
        rows: [
          { label: "Liquidity", value: "50,000,000 HANSOME (5%)", note: "Deployed into the official Uniswap v4 pool." },
          {
            label: "Treasury",
            value: "900,000,000 HANSOME (90%)",
            note: "Held for liquidity support, ecosystem growth, and future initiatives — see Treasury Policy.",
          },
          { label: "Founder", value: "50,000,000 HANSOME (5%)", note: "Founder allocation." },
        ],
        footnote:
          "These are the stated allocation targets. Live, current on-chain balances for every wallet are published at /transparency and can change over time as Treasury tokens are deployed into liquidity per the policy below.",
      },
      whyFixedSupply: {
        heading: "Why fixed supply?",
        body: "A mint function is a standing promise that the rules can change later. Removing it entirely means no one — including the team — can ever dilute holders, no matter how the project evolves. The tradeoff is real: it also means the project can never simply print its way out of a liquidity problem. That constraint is treated as a feature, not a bug, and it directly shapes the Treasury and Liquidity policies below.",
      },
    },
    treasury: {
      heading: "Treasury Policy",
      intro:
        "The Treasury wallet currently holds the largest single allocation of HANSOME. It is a single, publicly-visible wallet — it is not yet split into named sub-funds with fixed percentages for each purpose.",
      lines: [
        {
          label: "Liquidity",
          value: "Primary current use",
          detail:
            "Most Treasury deployment to date has gone toward funding and reinforcing the official Uniswap v4 liquidity position.",
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
        "Every wallet referenced above is public. Addresses, current balances, and the Uniswap v4 pool/position details are kept live at /transparency — that page, not this document, is the source of truth for current numbers.",
      wallets: [
        { title: "Deployment Wallet", purpose: "Contract deployment and technical operations.", allocation: "0%" },
        {
          title: "Liquidity Wallet",
          purpose: "Official Uniswap v4 liquidity management.",
          allocation: "Locked LP — 50,000,000 HANSOME + 0.075 ETH",
        },
        {
          title: "Treasury",
          purpose: "Treasury, ecosystem growth, partnerships, future liquidity, marketing and development.",
          allocation: "900,000,000 HANSOME (90%)",
        },
        { title: "Founder Wallet", purpose: "Founder allocation.", allocation: "50,000,000 HANSOME (5%)" },
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
        body: "The current approach favors a small number of well-understood positions over constant micromanagement. The intended long-term shape is a barbell: one tighter position for capital efficiency near the current price, plus at least one wider or full-range position sized as a standing backstop, so a single large trade can never fully exhaust tradeable liquidity in one direction. As of this writing, the project operates a single position; the backstop position is a planned addition, not yet deployed.",
      },
      lpFees: {
        heading: "LP Fees",
        body: "The pool carries a 0.05% swap fee, which accrues to whoever holds the liquidity position — currently the Treasury. These fees are real, on-chain revenue generated independently of any token tax, and the intent is to periodically collect and recycle them back into liquidity rather than let them sit unclaimed.",
      },
      multiplePositions: {
        heading: "Multiple LP Positions",
        body: "A single concentrated position has a hard capacity limit in each direction. Running more than one position — at different ranges, potentially funded from different sources — is the standard way serious concentrated-liquidity operators avoid that limit becoming a single point of failure. This is a stated design direction for HANSOME, planned but not yet implemented.",
      },
      noReactiveChasing: {
        heading: "Why We Won't Constantly Chase Price With Reactive Liquidity",
        body: "Adding liquidity immediately after every large trade, in direct reaction to that trade, tends to just get consumed by the next large trade — it's a treadmill, not a strategy. Instead, liquidity decisions are meant to be sized ahead of expected activity and tied to durable milestones (like sustained market-cap tiers), not to the most recent headline or the most recent scare.",
      },
    },
    revenue: {
      heading: "Revenue Strategy",
      intro:
        "HANSOME has 0% transaction tax by design, so it does not generate revenue the way older \"tax token\" meme coins did. Any future funding for liquidity or the project has to come from elsewhere. These are the sources currently active or under consideration — nothing here is guaranteed.",
      streams: [
        {
          id: "lp-fees",
          title: "LP Fees",
          statusKey: "active",
          status: "Active",
          body: "The 0.05% Uniswap v4 pool fee is the one revenue source already running today, scaling automatically with trading volume.",
        },
        {
          id: "merchandise",
          title: "Merchandise",
          statusKey: "exploratory",
          status: "Exploratory",
          body: "Alpaca-branded merchandise is a natural fit for the brand, but nothing has been produced or sold yet. TODO once/if this moves forward.",
        },
        {
          id: "partnerships",
          title: "Partnerships",
          statusKey: "exploratory",
          status: "Exploratory",
          body: "No partnerships, sponsorships, or cross-promotions currently exist. TODO — any future partnership will be announced when and if it's actually signed.",
        },
        {
          id: "ecosystem-products",
          title: "Future Ecosystem Products",
          statusKey: "exploratory",
          status: "Exploratory",
          body: "No additional products (games, tools, staking, etc.) are currently planned or in development. This category is left open intentionally rather than filled with speculative feature ideas.",
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
            { label: "Get discovered on DEX aggregators (GeckoTerminal, DexScreener)", done: true },
            { label: "Submit to broader listing platforms (CoinGecko, CoinMarketCap) — status: TODO, not yet confirmed", done: false },
            { label: "Deploy a second, wider liquidity position as a standing backstop", done: false },
            { label: "Begin periodic LP fee collection and recycling", done: false },
            { label: "Grow an early community around the brand, not around a price target", done: false },
          ],
        },
        {
          phase: "Phase 3",
          title: "Sustain",
          statusKey: "future",
          status: "Future",
          items: [
            { label: "Evaluate real, disclosed revenue sources (see Revenue Strategy) as they materialize", done: false },
            { label: "Formalize a rules-based, milestone-tied liquidity top-up schedule", done: false },
            { label: "Explore giving the community a real voice in treasury/liquidity decisions", done: false },
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
        "This project would rather have a hundred people who actually find the mascot funny and stick around than ten thousand people who forget the ticker by next week. Every policy in this document — the treasury discipline, the liquidity approach, the refusal to promise utility that doesn't exist — is really in service of that one goal: giving a real community something worth being part of.",
      ],
    },
    longTermVision: {
      heading: "Long-Term Vision",
      intro:
        "There is no guarantee this works. But the intended shape of a self-sustaining HANSOME looks like a loop, not a straight line — each stage feeding the next:",
      lifecycle: [
        { label: "Community", body: "People who actually engage, not just spectate." },
        { label: "Brand", body: "A recognizable mascot and identity people want to share." },
        { label: "Products", body: "Real things the brand can support — merchandise, collaborations, tools (see Revenue Strategy)." },
        { label: "Revenue", body: "Actual income from those products and from LP fees — not speculation." },
        { label: "Treasury", body: "That revenue accumulates transparently, publicly, on-chain." },
        { label: "Liquidity", body: "Treasury funds reinforce and diversify liquidity on a deliberate schedule." },
      ],
      loopLabel: "The Loop",
      closing:
        "Today, HANSOME is at the very start of this loop — mostly \"Community\" and \"Brand,\" with almost nothing yet in \"Products\" or \"Revenue.\" This document is meant to be revisited and honestly updated as that changes, not rewritten to pretend it was always further along.",
    },
    faq: {
      heading: "FAQ",
      items: [
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
