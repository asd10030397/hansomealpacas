import type { Messages } from "@/content/i18n/types";

export const zh: Messages = {
  locale: "zh",
  htmlLang: "zh-Hans",
  language: {
    zh: "中文",
    en: "EN",
    toggleLabel: "语言",
  },
  a11y: {
    skipToContent: "跳至内容",
    primaryLinks: "主要链接",
    socialLinks: "社群链接",
    coinAlt: "HANSOME ALPACAS 金币",
    copyContract: "复制合约地址",
    copiedContract: "已复制",
    copyWebsite: "复制网站网址",
    shareDevice: "分享",
  },
  hero: {
    memeBadge: "MEME COIN",
    tagline: "天生赢家脸，一辈子没屁用。",
    tickerLabel: "代号",
    ticker: "$HANSOME",
    chain: "Robinhood Chain",
    chainStatus: "（未上线）",
    readLitepaper: "📖 阅读白皮书",
    playGame: "🎮 开始游戏",
    downloadAndroidApp: "下载 Android App",
    downloadAndroidSubtext: "Android APK · 直接下载",
    downloadAndroidInstallNote: "Android 可能会要求允许「安装未知来源应用程序」。",
    buy: "BUY",
    chart: "CHART",
    x: "X",
    telegram: "TELEGRAM",
    website: "官网",
  },
  tokenomics: {
    eyebrow: "TOKENOMICS",
    title: "代币经济",
    subtitle: "纯迷因币数学。零税。零实用承诺。",
    tickerLabel: "代号",
    ticker: "$HANSOME",
    items: [
      { label: "代号", value: "HANSOME", variant: "ticker" },
      { label: "总供应量", value: "1B", secondary: "1,000,000,000 HANSOME" },
      {
        label: "网络",
        valueLines: ["Robinhood", "Chain"],
        badge: "即将推出",
        variant: "network",
      },
      { label: "税", value: "0%" },
      {
        label: "流动性",
        value: "锁仓",
        secondary: "至 2027 年 7 月",
        link: { href: "/transparency", label: "查看锁仓详情 →" },
      },
    ],
  },
  buy: {
    title: "BUY $HANSOME",
    subtitle: "在 hansomealpacas.xyz 直接用 ETH 兑换 HANSOME — 由 Uniswap Universal Router 提供。",
    cta: "领取 HANSOME",
    ctaSublabel: "喂饱羊驼们",
    launchingSoon: "即将推出",
    comingSoon: "（即将推出）",
  },
  swap: {
    eyebrow: "SWAP",
    title: "SWAP",
    subtitle: "在 Robinhood Chain 上通过 Uniswap Universal Router 交易 ETH 与 HANSOME。",
    backHome: "首页",
    connectWallet: "连接钱包",
    disconnectWallet: "断开连接",
    switchNetwork: "切换至 ROBINHOOD CHAIN",
    youPay: "支付",
    youReceive: "收到",
    balance: "余额",
    slippage: "滑点容忍度",
    flipDirection: "切换兑换方向",
    fillPercent: "填入",
    fillMax: "填入最大可用金额",
    swap: "SWAP",
    swapping: "兑换中…",
    approveToken: "授权 HANSOME",
    approveRouter: "授权 ROUTER",
    addToWallet: "加入 HANSOME 至钱包",
    watchAssetSuccess: "已加入 HANSOME — 请在 MetaMask 确认 Logo 显示。",
    watchAssetFailed: "无法加入 HANSOME 至钱包。",
    watchAssetRejected: "您已取消加入 HANSOME。",
    viewOnBlockscout: "在 Blockscout 查看",
    viewTx: "查看交易",
    network: "网络",
    status: {
      loading: "交易处理中",
      success: "兑换成功",
      failed: "交易失败",
      connectionFailed: "钱包连线",
      confirming: "等待确认…",
      approvingToken: "正在授权 HANSOME 给 Permit2…",
      approvingPermit2: "正在授权 Universal Router…",
      swapping: "正在提交兑换…",
      swapComplete: "兑换已完成。",
    },
  },
  about: {
    title: "WTF IS HANSOME ALPACAS？",
    subtitle: "HANSOME ALPACAS 是一个社群驱动的迷因币。",
    blocks: [
      { lines: ["这只羊驼，天生赢了基因乐透。"], gapAfter: "lg" },
      { lines: ["每个生态都需要一个吉祥物。"], gapAfter: "lg" },
      { lines: ["我们选了最帅的那只。"], gapAfter: "lg" },
      { lines: ["毛色完美。", "脸型无敌。", "没有任何一技之长。"], gapAfter: "lg" },
      { lines: ["不是 CT 让我们出名。"], gapAfter: "md" },
      { lines: ["是帅。"], gapAfter: "none" },
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "常见问题",
    items: [
      {
        question: "HANSOME 是迷因币吗？",
        answer: "是，100%。HANSOME ALPACAS 是社群迷因币——文化第一、氛围第二、免责声明永远在。",
      },
      {
        question: "$HANSOME 是什么？",
        answer: "迷因币。一只超帅的羊驼。一个代号。就这样。",
      },
      {
        question: "什么时候上线？",
        answer: "准备在 Robinhood Chain 上线。前往 hansomealpacas.xyz/swap 兑换。",
      },
      {
        question: "在哪里购买？",
        answer: "上线后在这里。现在还不行。",
      },
      {
        question: "有空投吗？",
        answer: "有些好玩的事正在酝酿中……敬请期待未来的社群活动。",
      },
      {
        question: "在哪条链？",
        answer: "Robinhood Chain。",
      },
      {
        question: "HANSOME 有任何功能吗？",
        answer: "现在？就只是很帅。未来的功能与惊喜活动——敬请期待。",
      },
    ],
  },
  contract: {
    eyebrow: "CONTRACT",
    title: "合约地址",
    subtitle: "官方合约地址",
    addressLabel: "官方 CA",
    placeholder: "合约将于上线时公布。",
    comingSoon: "即将推出",
    copied: "COPIED",
    copy: "COPY",
    viewExplorer: "在区块浏览器查看",
    viewOfficialWallets: "View Official Wallets",
    shareOnX: "SHARE ON X",
    copyUrl: "COPY URL",
    copyCa: "COPY CA",
    share: "SHARE",
    copyFailed: "Copy failed. Try again.",
  },
  download: {
    meta: {
      title: "下载 Android App | HANSOME ALPACAS",
      description:
        "HANSOME 游戏 Android 版直接 APK 下载。含构建日期、文件大小与 SHA-256 校验值。",
    },
    backHome: "← 首页",
    eyebrow: "ANDROID APP",
    title: "下载 Android App",
    subtitle: "通过 APK 直接安装 HANSOME 游戏 — 非 Google Play 渠道。",
    buildDate: "构建日期",
    fileSize: "文件大小",
    sha256: "SHA-256",
    downloadApk: "下载 APK",
    downloadSubtext: "Android APK · 直接下载",
    directApkNote:
      "稳定链接：game.hansomealpacas.xyz/downloads/hansome-android.apk — 版本化构建文件保留供校验。",
    installHeading: "安装步骤",
    installSteps: [
      "使用上方按钮下载 APK。",
      "从浏览器或文件管理器打开已下载的文件。",
      "若出现提示，请允许此浏览器或文件管理器安装应用。",
      "点击安装，然后从主屏幕打开 HANSOME。",
    ],
    installNote:
      "Android 可能会要求允许「安装未知来源应用程序」。此为调试版 APK，仅供直接侧载安装 — 未上架 Google Play。",
    versionedLabel: "版本化构建",
    stableLabel: "稳定下载",
  },
  liveStatus: {
    title: "实时状态",
    network: "网络",
    token: "代币",
    supply: "供应量",
    tax: "税",
    status: "状态",
    statusPreparing: "准备上线",
    statusLive: "已上线",
  },
  community: {
    eyebrow: "COMMUNITY",
    title: "社群",
    holders: "持有者",
    transactions: "交易",
    liquidity: "流动性",
    marketCap: "市值",
    comingSoon: "即将推出",
  },
  market: {
    eyebrow: "MARKET",
    title: "MARKET STATS",
    subtitle: "GeckoTerminal 实时 HANSOME/ETH 池数据（Robinhood Chain Uniswap v4）。",
    loading: "Loading",
    unavailable: "Market data temporarily unavailable",
    tokenPrice: "HANSOME 价格",
    liquidity: "流动性",
    change24h: "24H 涨跌",
    volume24h: "24H 成交量",
    transactions24h: "24H 交易",
    txBuys: "买",
    txSells: "卖",
    liveRefresh: "每 30 秒自动更新 · 来源：GeckoTerminal",
  },
  chart: {
    eyebrow: "LIVE CHART",
    title: "Live $HANSOME Chart",
    subtitle: "DEXTools 实时 HANSOME/ETH 走势（Robinhood Chain）。",
    iframeTitle: "DEXTools HANSOME 实时价格图表",
    viewOnDextools: "在 DEXTools 查看",
  },
  footer: {
    tagline: "天生赢家脸，一辈子没屁用。",
    memeLovers: "为迷因爱好者而生。",
    notFinancialAdvice: "不构成投资建议。",
    stayHansome: "保持帅气。🦙",
    builtOn: "Built on Robinhood Chain",
    explorer: "区块浏览器",
    transparency: "Transparency",
    litepaper: "Litepaper",
    copyright: "© 2026 HANSOME ALPACAS",
    disclaimer:
      "$HANSOME 为迷因代币，没有内在价值，也不保证任何回报。本网站仅供娱乐，不构成投资建议。加密货币波动剧烈，请自行研究，只投入可承受损失的资金。",
  },
  transparency: {
    purpose: "用途",
    liquidityPosition: "流动性部位",
    allocation: "分配比例",
    address: "地址",
    copyAddress: "复制地址",
    copied: "已复制",
    viewBlockscout: "在 Blockscout 查看",
  },
  litepaper: {
    meta: {
      title: "白皮书 | HANSOME ALPACAS",
      description:
        "HANSOME ALPACAS 白皮书：创办人的话、愿景、GameFi 经济模型、代币经济学、金库政策、流动性政策、营收策略、路线图与常见问题——今天真正做到的事，以及老实说，我们想带这只帅羊驼走向哪里。",
    },
    nav: {
      onThisPage: "本页目录",
      sections: {
        "founder-letter": "创办人的话",
        introduction: "简介",
        vision: "愿景",
        philosophy: "核心理念",
        "gameplay-overview": "游戏简介",
        "gamefi-economic-model": "GameFi 经济模型",
        documents: "文件下载（DOC）",
        tokenomics: "代币经济学",
        treasury: "金库政策",
        liquidity: "流动性政策",
        revenue: "营收策略",
        roadmap: "路线图",
        community: "社群",
        "sustainable-ecosystem": "建立可持续发展的生态系",
        "long-term-vision": "长期愿景",
        faq: "常见问题",
        changelog: "更新记录",
        language: "语言与翻译",
      },
    },
    backHome: "← hansomealpacas.xyz",
    downloadPdf: "下载白皮书 PDF",
    downloadEconomicModelPdf: "经济模型 PDF",
    documentsLibrary: {
      heading: "文件下载（DOC）",
      blurb:
        "本站 /docs 提供的正式下载档。分享建议用 PDF；在编辑器阅读可用 Markdown。",
      litepaperEn: "白皮书（英文 PDF）",
      litepaperZh: "白皮书（中文 PDF）",
      economicPdfEn: "GameFi 经济模型（英文 PDF）",
      economicPdfZh: "GameFi 经济模型（中文 PDF）",
      economicMdEn: "GameFi 经济模型（英文 Markdown）",
      economicMdZh: "GameFi 经济模型（中文 Markdown）",
      openInBrowser: "开启",
    },
    hero: {
      eyebrow: "白皮书",
      title: "HANSOME ALPACAS",
      subtitle: "一份公开记录，说明这个项目是什么、不是什么，以及我们希望带它走到哪里——不做我们做不到的承诺。",
      meta: [
        { label: "链", value: "Robinhood Chain" },
        { label: "总供应量", value: "1,000,000,000 HANSOME" },
        { label: "交易税", value: "0%" },
        { label: "合约", value: "不可变更、无法增发" },
      ],
    },
    statusLabels: {
      live: "已上线",
      planned: "规划中",
      exploratory: "探索中",
    },
    founderLetter: {
      heading: "创办人的话",
      paragraphs: [
        "我们并不是因为做出了什么产品才开始 HANSOME ALPACAS。纯粹是「一只赢了基因乐透、却什么用都没有的羊驼」这个想法让我们自己笑了出来，我们猜也会让别人笑出来。这一点到现在都没变。代币是那个笑话——但它本来就是一个开始，不是全部。",
        "诚实说，计划是这样的：HANSOME 从一枚迷因币开始。如果真的有够多人因为觉得一只蠢帅的羊驼很好笑而留下来，我们想把它变成一个真正的品牌——原创内容、社群活动、迷因比赛、周边商品，或许还有合作伙伴关系。上面这些，一项都还没发生。我们把这些告诉你，是因为这是真话，不是因为我们明天就能生出来。",
        "我们今天能承诺的，比这个更小、也更朴实：一个永远不能再增发的固定供应量、一份任何人（包括我们自己）都无法更改的合约，以及每一个碰过这颗代币的钱包的公开记录。我们没办法承诺你一件连帽外套。我们能承诺的是一份我们无法作弊的合约，以及日后任何真正的承诺都会清楚写进这份文件、附上日期——不是在某个群组里随口说说就算了。",
        "这份文件是我们目前最接近「计划」的东西。它说明今天什么是真的、如果这个社群持续成长我们真心想做什么、以及这两者之间的界线在哪里。遇到我们还没有答案的地方，我们选择老实说不知道，而不是硬掰一个听起来有信心的答案。如果一年后 HANSOME 还在，我们希望原因是有一群真正的社群，觉得这只羊驼——以及我们围绕着它建立起来的一切——值得留下来，而不是因为我们在最初把话说得太满。",
        "谢谢你把这篇读到这里。光是这一点，就已经比大部分冲进迷因币的人多做了一步。",
      ],
      signature: "— HANSOME ALPACAS 团队",
    },
    introduction: {
      heading: "简介",
      paragraphs: [
        "HANSOME ALPACAS 一开始就是一枚迷因币——一只极度帅气的羊驼、一个代号、零一技之长——在 Robinhood Chain 上通过 Uniswap v4 集中流动性池与 ETH 交易。它今天背后没有产品，我们也不打算装作有。",
        "但代币从来不是故事的全部。如果 HANSOME 周围的社群持续成长，我们的计划是让品牌跟着一起成长：原创内容、社群主办的活动、迷因比赛、周边商品（服饰、玩偶、贴纸这类的），还有合适的话，合作伙伴关系。上面这些，目前一项都不存在。这份文件把这件事讲清楚，而不是把一份愿望清单包装成路线图。",
        "今天真正存在的是：固定且无法增发的供应量、一份没有任何管理者特权的不可变更合约，以及每一个碰过这颗代币的钱包的公开记录。这份文件的目的，就是老实说清楚今天什么是事实、什么只是期望，以及两者之间的界线在哪里——让这个项目的信任建立在记录上，而不是说法上。",
      ],
      whatIsHansome: {
        heading: "HANSOME 是什么？",
        paragraphs: [
          "HANSOME ALPACAS（代号：HANSOME）是一颗部署在 Robinhood Chain 上、供应量固定、0% 交易税的 ERC-20 代币。它唯一自称的身分，就是它诞生的那个笑话：一只极度帅气、却在设计上毫无用途的羊驼。",
          "代币合约里没有质押机制、没有游戏、没有收益机制，也没有任何写进合约里的未来功能承诺——没有清楚、独立公告之前，也不会有。这句话讲的是合约，不是我们对这个品牌的野心。想知道我们真正想带它去哪里，请看下面的「愿景」。",
        ],
      },
    },
    vision: {
      heading: "愿景",
      paragraphs: [
        "大部分迷因币的设计就是冲一波然后淡去。我们宁愿做那个在第一波热度退去之后，还在这里、而且还在成长的版本——就算这代表走得比较慢、讲话比较小声。",
        "诚实说，我们想带这个项目去的地方是：HANSOME 从一枚迷因币开始，但代币是起点，不是终点。如果真的有一个真实的社群，围绕着这只荒谬又帅气的羊驼形成，我们想把它变成一个真正的品牌——原创内容、社群主导的活动、迷因比赛、周边商品，合适的话再加上合作伙伴关系。不是元宇宙，也不是那种塞满流行术语的「实用型代币」白皮书。就只是一只值得追踪的羊驼，在 Web3 里、也在 Web3 之外。",
        "这些都不需要特定的价格、市值或上架某个交易所才能发生——需要的是真正想留在这里的人。所以顺序是：先有一个小而真实的社群，再有一个保守、透明管理的金库，等到真的有值得建构的东西之后，再在这两者之上建立品牌。",
      ],
    },
    philosophy: {
      heading: "核心理念",
      pillars: [
        {
          title: "社群优先",
          body: "没有私募，也没有卖给场外投资人的私人额度。今天持有 HANSOME 的人，取得代币的方式跟任何其他人一样——在公开市场上买进。",
        },
        {
          title: "代币只是起点",
          body: "HANSOME 是以迷因币的身分上线的，今天它也确实就只是这样——我们不会装作不是。但这不是我们想停下来的地方。如果社群持续成长，我们的打算是在它之上建立一个真正的羊驼品牌：内容、活动、周边商品、合作伙伴关系。这是一个公开说出来的方向，不是一个附带交付日期的承诺。",
        },
        {
          title: "0% 交易税",
          body: "每一笔买卖都按照报价全额成交。没有暗中抽走一部分转进某个钱包的隐藏费用，没有「自动流动性」抽成，代币合约里也没有任何机制会从你的交易中抽走一分一毫。",
        },
        {
          title: "不可变更合约",
          body: "HANSOME 合约没有任何管理者功能：不能增发、没有黑名单、不能暂停、不能更改交易税，也没有能在部署后改变合约行为的管理密钥。部署出去的样子，就是它永远的样子。",
        },
        {
          title: "透明公开",
          body: "这个项目涉及的四个钱包——部署钱包、流动性钱包、金库与创办人钱包——全部公开，任何时候都能在链上查证。详见下方「金库政策」章节，以及实时更新的 /transparency 页面，查看目前地址与余额。官方钱包、金库动向、流动性信息等透明度相关资料都会放在那个页面上，并尽可能以链上信息实时更新。金库执行的每一项流动性操作——包括「流动性政策」章节中提到的 2026 年 7 月流动性优化——都是通过任何人都能查证的公开交易完成的，而原始的锁仓部位在整个过程中完全没有被动过。这些决策追求的都是长期的可持续发展，而不是短期的热度。",
        },
        {
          title: "长期思维",
          body: "流动性与金库支出的决策，是依照事先订好的原则进行，而不是看今天 Twitter 上发生了什么就临时反应。这份文件会逐章说明目前这些原则具体是什么。",
        },
      ],
    },
    gameplayOverview: {
      heading: "游戏简介",
      opening: "HANSOME: Alpacas vs Cougars 不只是一个 NFT 收藏系列。",
      paragraphs: [
        "每一只 Genesis NFT 都是链上生存游戏中的可游玩角色，玩家将在游戏中竞争、生存并获得奖励。",
        "玩家可以成为：",
      ],
      roles: [
        "🦙 羊驼——躲避狩猎、努力生存并撑到最后。",
        "🐆 美洲狮——追踪猎物、展开狩猎并击败对手。",
      ],
      loopLabel: "玩家每天都会经历：",
      closing: [
        "提交行动 → 揭露行动 → 结算 → 领取奖励",
        "不同的 NFT 特性与能力将影响游戏体验与策略选择。",
        "本白皮书仅提供游戏生态的简单介绍。",
        "若想了解完整玩法、NFT 能力、地点、奖励池、结算规则与领奖方式，请前往 Game 页面。",
      ],
      imageAlt: "像素艺术：美洲狮与叼着草的羊驼在山间草地对峙",
      captionTitle: "HANSOME: Alpacas vs Cougars",
      captionLines: [
        "同一个世界。",
        "两种命运。",
        "🦙 以羊驼求生。",
        "🐆 以美洲狮狩猎。",
        "每一只 NFT 都能游玩。",
        "每一个决策都很重要。",
      ],
      cta: {
        heading: "想了解游戏怎么玩？",
        body: "本白皮书仅提供高阶概览。",
        bullets: [
          "每日游戏循环",
          "NFT 能力",
          "奖励池",
          "地点",
          "狩猎机制",
          "结算规则",
          "领取奖励",
        ],
        button: "查看完整游戏内容",
        href: "/game",
      },
    },
    gamefiEconomicModel: {
      heading: "GameFi 经济模型",
      intro: [
        "HANSOME：羊驼 VS 美洲狮是部署于 Robinhood Chain 的日结算 GameFi 经济。每日奖励由 GameTreasury 持有的 $HANSOME 支付——并非新铸造。结果取决于参与度、决策、国库健康度与市场条件。本节不承诺获利或固定收益。",
        "完整数学分析——排放阶梯、奖池拆分、羊驼与美洲狮经济、赛局框架、国库跑道，以及相对于典型 P2E 为何朝向长期永续——已另以独立报告公开，供玩家与研究者阅读。",
      ],
      highlightsHeading: "模型说明重点",
      highlights: [
        "每日奖池 Rd = f(G)，采已实作阶梯（当 G ≥ 0.70·G0 时 R0 = 400,000）",
        "上线国库：初始注资 30,000,000 HANSOME → 起始档 80,000／日；国库成长至 60M／120M／210M 时自动解锁更高奖励档",
        "奖池拆分：羊驼 80% · 美洲狮基础 10% · 狩猎 10%",
        "守恒：玩家领取 + 惩罚 + 未分配 = Rd",
        "协议阶梯参考 G0 = 300,000,000（设计尺度）；最高档粗略跑道示意 G0／R0 ≈ 750 天（实际寿命随注资、阶梯、sinks、Claim 而变）",
        "双边价值：玩家决策与 NFT 效用，以及生态系可持续跑道",
        "长期设计：固定供应＋国库支付奖励、阶梯排放、无需升级合约即可逐步扩展国库、羊驼／美洲狮相互需求（不保证获利）",
      ],
      disclaimer:
        "奖励为有条件发放。未 Reveal、安全模式（G < Gsafe）或族群失衡都可能减少或取消当日收益。非投资建议。",
      linksHeading: "经济模型文件",
      links: {
        reportEn: "英文报告（Markdown）",
        reportZh: "中文报告（Markdown）",
        pdfEn: "下载 PDF（英文）",
        pdfZh: "下载 PDF（中文）",
        game: "开启线上游戏",
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
      heading: "代币经济学",
      diagramCenterLabel: "HANSOME",
      legend: {
        treasury: "金库",
        liquidity: "流动性",
        founder: "创办人",
      },
      totalSupply: {
        heading: "总供应量",
        value: "1,000,000,000 HANSOME",
        body: "供应量在部署时就已固定，不会再改变。合约里没有增发功能——团队不能增发，管理者不能增发，任何人都不能增发。",
      },
      distribution: {
        heading: "初始分配（上线当天）",
        body: "这是这个项目三个持有代币的钱包，在上线第一天的分配方式——不是它们今天各自持有的数字：",
        rows: [
          { label: "流动性", value: "50,000,000 HANSOME（5%）", note: "上线时已存入官方 Uniswap v4 流动性池。" },
          {
            label: "金库",
            value: "900,000,000 HANSOME（90%）",
            note: "这是它一开始的余额，不是现在的余额——详见下方说明与「金库政策」，了解后来发生了什么事。",
          },
          { label: "创办人", value: "50,000,000 HANSOME（5%）", note: "创办人配额。" },
        ],
        footnote:
          "以上百分比描述的是上线时的初始分配，不是实时的实时快照。目前余额会随时间变动——尤其是金库，因为代币会依照下方「金库政策」与「流动性政策」持续被投入官方流动性。金库余额变少，几乎都代表这些代币被转换成一个公开、可验证的流动性部位，而不是被卖掉。想知道每个钱包现在真正持有多少，请前往 /transparency——那个页面，而不是这份文件，才是实时的第一来源。",
      },
      whyFixedSupply: {
        heading: "为什么要固定供应量？",
        body: "增发功能等于是预先承诺规则以后还可以改。彻底拿掉这个功能，代表没有任何人——包括我们自己——能在项目发展过程中稀释持有人的权益。这确实是有代价的：这也意味着这个项目永远没办法靠印代币来解决流动性问题。我们把这个限制视为一个特色，而不是缺陷，它也直接决定了下面「金库政策」与「流动性政策」的走向。",
      },
    },
    treasury: {
      heading: "金库政策",
      intro:
        "金库钱包一开始持有 HANSOME 单一最大的配额——上线时是总供应量的 90%。它今天的余额比这个数字低，而且会持续随时间变动，主要原因是把代币投入官方流动性，本身就是金库的一项操作（详见下方）。这一节说明的是政策——金库的用途，以及决策是怎么做的。至于金库现在真正持有多少，永远请看 /transparency，不是这份文件。它是一个公开可查的单一钱包——目前还没有拆分成几个各自订好固定比例的子账户。",
      lines: [
        {
          label: "流动性",
          value: "目前主要用途",
          detail:
            "到目前为止，金库的支出大部分都用于挹注与加强官方的 Uniswap v4 流动性部位。这也是金库目前余额低于初始 90% 配额的主要原因——那些代币没有被卖掉，而是转换成了一个公开、可验证的流动性部位（详见 /transparency 上的流动性钱包，以及下方「流动性政策」）。",
        },
        {
          label: "社群",
          value: "规划中——待定",
          detail: "目前还没有订出专门给社群奖励的固定额度或预算。未来若有任何承诺，会公开宣布，而不是先让大家自行假设。",
        },
        {
          label: "开发",
          value: "规划中——待定",
          detail: "目前还没有划出开发预算，因为除了核心代币与网站之外，暂时没有其他需要资金的产品路线图。若情况改变，会重新检视这一项。",
        },
        {
          label: "团队",
          value: "见创办人配额",
          detail: "唯一与团队相关的配额，就是创办人钱包（50,000,000 HANSOME，5%）。金库里没有另外设立额外的团队基金。",
        },
      ],
      transparencyHeading: "透明公开",
      transparencyBody:
        "上面提到的每一个钱包都是公开的。地址，以及 Uniswap v4 资金池／部位的细节，列在下方；目前余额则是从合约实时读取，显示在 /transparency 页面。那个页面，而不是这份文件，才是每个钱包现在真正持有多少的第一来源——下面列出的数字，是每个钱包上线时的初始配额，不是实时数字。",
      wallets: [
        { title: "部署钱包", purpose: "合约部署与技术操作。", allocation: "初始配额：0%" },
        { title: "流动性钱包", purpose: "官方 Uniswap v4 流动性管理。", allocation: "初始 LP 存入：50,000,000 HANSOME + 0.075 ETH" },
        {
          title: "金库",
          purpose: "金库、生态发展、合作伙伴关系、未来流动性、营销与开发。",
          allocation: "初始配额：900,000,000 HANSOME（90%）——目前余额较低，详见 /transparency",
        },
        { title: "创办人钱包", purpose: "创办人配额。", allocation: "初始配额：50,000,000 HANSOME（5%）" },
      ],
      viewWallets: "查看实时钱包地址与余额 →",
    },
    liquidity: {
      heading: "流动性政策",
      concentratedLiquidity: {
        heading: "集中流动性",
        body: "HANSOME 通过 Uniswap v4 资金池以集中流动性的方式交易：资金被投入一段设定好的价格区间，而不是覆盖从 0 到无限大的整条曲线。这让区间内的每一分流动性都能发挥更大的效果，代价是一旦价格移出这个区间，部位就会完全变成单边。这个取舍是刻意为之，不是意外——这也代表流动性的深度是一项政策决定，不是设定好就不管的默认值。",
      },
      longTermStrategy: {
        heading: "长期 LP 策略",
        body: "目前的做法偏好维持少数几个容易理解的部位，而不是不断微调。我们期望的长期结构是「杠铃型」：一个靠近目前价格、资金效率较高的窄区间部位，再加上至少一个更宽或全区间的部位作为常态后备，确保单一一笔大额交易永远无法把某个方向的可交易流动性完全耗尽。截至 2026 年 7 月，这个杠铃结构已经正式上线——详见下方「流动性优化」。",
      },
      lpFees: {
        heading: "LP 手续费",
        body: "资金池收取 0.05% 的交易手续费，会累积给目前持有流动性部位的一方——目前是金库。这笔手续费是真实、独立于任何代币税之外的链上收入，我们的目标是定期把它领出来、再投入流动性，而不是让它一直闲置不动。",
      },
      onChainVerification: {
        heading: "上链验证",
        body: "官方 Uniswap v4 流动性部位（#47299）已通过 TitanLockerManagerV2 锁仓，将于 2027 年 7 月 15 日解锁。这不需要单靠我们的说法——锁仓合约与锁仓交易都公开在 Blockscout 上，任何人都可以自行验证。",
        links: [
          {
            href: "https://robinhoodchain.blockscout.com/address/0x26b0654A0756DCd036D4e7215324f3D2Be34D79e",
            label: "查看锁仓合约 →",
          },
          {
            href: "https://robinhoodchain.blockscout.com/tx/0x8ac188afa59c9bc26626bfec6977fbc25c294003d8761b2e41030ad0aab3bcf3",
            label: "查看锁仓交易 →",
          },
        ],
      },
      liquidityOptimization: {
        heading: "流动性优化（2026 年 7 月）",
        body: "2026 年 7 月，金库在官方 Uniswap v4 资金池上完成了一次流动性优化。原始锁仓 365 天的部位（#47299，详见上方「上链验证」）完全没有被动过，锁仓状态没有被解除或更改。在它之外，金库另外新增了两个由金库持有的流动性部位：一个窄区间部位，用来降低目前价格附近的交易滑价；以及一个宽区间部位，作为额外的下跌保护。加总起来，这让官方流动性背后的资金规模，比原本只有单一锁仓部位时明显提高。这一切资金都来自公开揭露的金库流动性管理，每一步都可以在链上公开查证。",
      },
      improvedTradingExperience: {
        heading: "交易体验改善",
        body: "在上述优化之后，官方资金池在一般交易规模下的滑价已经明显降低。中大额交易现在的执行效率更高，价格冲击比之前更小。目前价格两侧的市场深度都变得更好，第一次买进的新持有人，体验也比之前明显顺畅许多。",
      },
      multiplePositions: {
        heading: "多个 LP 部位",
        body: "单一集中流动性部位在每个方向上都有明确的容量上限。同时运作多个部位——分布在不同价格区间、甚至来自不同资金来源——是有经验的集中流动性操作者，避免单一部位变成单点故障的标准做法。如上方「流动性优化」所述，这个做法目前已经在 HANSOME 上实作完成：原始锁仓部位现在与另外两个金库持有的新部位一起运作。",
      },
      noReactiveChasing: {
        heading: "为什么我们不会用反应式流动性追着价格跑",
        body: "每次出现大额交易后立刻反应式地补流动性，通常只是把补进去的部分让下一笔大额交易吃掉——那是踏轮机，不是策略。我们的做法是提前依照预期的活动量规划流动性，并绑定在比较持久的里程碑上（例如稳定维持在某个市值区间），而不是看最新的头条新闻或最近一次的恐慌行情临时反应。",
      },
    },
    revenue: {
      heading: "营收策略",
      intro:
        "HANSOME 在设计上就是 0% 交易税，所以不会像早期那些「抽税型」迷因币一样自动产生收入。未来要挹注流动性、或是真正把「愿景」里提到的品牌做出来，资金得从真实的地方来——不是靠印更多 HANSOME。以下是目前真正在运作的，以及如果情况持续成长，我们想推动起来的。以下没有任何一项是保证会实现的。",
      streams: [
        {
          id: "lp-fees",
          title: "LP 手续费",
          statusKey: "active",
          status: "已上线",
          body: "0.05% 的 Uniswap v4 资金池手续费，是目前唯一已经在运作的收入来源，会随交易量自动增减。它不多，但是真的，也是这份清单里唯一一项我们不需要等待就已经在发生的事。",
        },
        {
          id: "merchandise",
          title: "周边商品",
          statusKey: "exploratory",
          status: "探索中",
          body: "服饰、玩偶、贴纸——对一只这么帅的吉祥物来说，周边商品是很自然的方向，而且它是长期计划里真实的一部分，不只是随口写上去的项目。目前还没有任何一款真正设计、制作或贩售。我们宁愿等到社群大到真的想要它的时候再好好做，也不想为了赶时间推出一件没人要的连帽外套。",
        },
        {
          id: "partnerships",
          title: "合作伙伴",
          statusKey: "exploratory",
          status: "探索中",
          body: "目前没有任何赞助、合作或联名关系存在。如果真的出现合适的机会——真正符合这个品牌、而不只是花钱买一则宣传贴文——我们会认真考虑，并在确定之后才对外公布。目前还没有。",
        },
        {
          id: "ecosystem-products",
          title: "未来生态产品",
          statusKey: "exploratory",
          status: "探索中",
          body: "目前没有规划或开发中的额外产品（工具、联名、限量发售等）。随着品牌这一侧逐渐成长——内容、社群活动、迷因比赛——其中有些可能会变成真正能带来收入的东西。目前还没有，我们刻意把这一类留白，而不是用一堆空想的功能点子把它填满。",
        },
      ],
    },
    roadmap: {
      heading: "路线图",
      phases: [
        {
          phase: "第一阶段",
          title: "打好基础",
          statusKey: "completed",
          status: "已完成",
          items: [
            { label: "部署供应量固定、无法增发、不可变更的 HANSOME 合约", done: true },
            { label: "建立官方的 Uniswap v4 ETH/HANSOME 流动性池", done: true },
            { label: "上线官方网站、交易界面与 /transparency 页面", done: true },
            { label: "发布这份白皮书", done: true },
          ],
        },
        {
          phase: "第二阶段",
          title: "站稳脚步、听社群的话",
          statusKey: "inProgress",
          status: "进行中",
          items: [
            { label: "被 DEX 信息聚合平台收录——已正式上架 GeckoTerminal 与 DexScreener", done: true },
            {
              label:
                "官方 Uniswap v4 流动性部位（#47299）已通过 Titan Locker 锁仓 365 天，将于 2027 年 7 月解锁——这是对长期流动性的具体承诺，可在 /transparency 上验证",
              done: true,
            },
            {
              label: "由金库主导，完成官方 Uniswap v4 资金池的流动性优化，在原始锁仓部位之外新增两个金库持有的流动性部位（详见「流动性政策」）",
              done: true,
            },
            { label: "改善 Robinhood Chain 上的交换基础设施与 Gas 费用处理，提升交易可靠性", done: true },
            { label: "建立内部工具，协助金库进行流动性管理", done: true },
            { label: "持续针对网站与整体交易体验进行渐进式改善", done: false },
            { label: "已送出 CoinGecko 上架申请，审核中", done: false },
            { label: "已送出 CoinMarketCap 上架申请，审核中", done: false },
            { label: "开始定期领取并回收 LP 手续费", done: false },
            {
              label: "持续观察市场状况与流动性深度——如果交易量与社群成长真的需要，未来会再加入更多流动性",
              done: false,
            },
            { label: "持续专注在建立 HANSOME 品牌，而不是追逐短期价格目标", done: false },
            { label: "持续扩大早期社群", done: false },
          ],
        },
        {
          phase: "第三阶段",
          title: "维持下去、把品牌做起来",
          statusKey: "future",
          status: "未来规划",
          items: [
            { label: "评估真实、已公开的营收来源（见「营收策略」），视实际情况推进", done: false },
            { label: "把里程碑式的流动性补充机制正式订成规则", done: false },
            { label: "探索让社群在金库与流动性决策上真正拥有发言权", done: false },
            { label: "如果社群真的在这里，开始把品牌做成不只是一张走势图——内容、社群活动、迷因比赛", done: false },
            { label: "等有了真正的社群可以服务之后，探索周边商品（服饰、玩偶、贴纸）与合作伙伴关系", done: false },
            { label: "没有固定日期、没有承诺的交易所上架、没有价格目标——这个阶段是方向，不是合约", done: false },
          ],
        },
      ],
    },
    community: {
      heading: "社群",
      paragraphs: [
        "热度是一次尖峰，社群才是地板。一波热潮可以在很短时间内带来大量关注，也可以同样快速地把这些关注全部带走，什么都不留下。社群——就算规模很小——才是在图表停止跳动之后，还会留下来在乎这件事的人。",
        "这个项目宁愿有一百个真心觉得吉祥物好笑、并且愿意留下来的人，也不想要一万个下周就忘记代号的人。这份文件里的每一项政策——金库的自律、流动性的做法、老实区分什么是真的、什么只是方向——说到底都是为了同一个目标：给一个真实的社群，以及日后跟这个社群一起打造出来的真正品牌，一个值得参与的理由。",
        "这已经不只是一个希望了。我们已经有一个真正在运作的 Telegram 社群，靠自然成长慢慢变大，而不是靠付费推广冲出来的。我们会定期举办迷因比赛、抽奖、AMA 问答与社群活动，给真正愿意参与的人，也开始与 KOL 合作、推动更广泛的营销活动，把值得留下来的人带进来。社群的参与度，正逐渐成为这个项目最重要的优先事项之一，和金库、流动性的自律并列。",
      ],
    },
    sustainableEcosystem: {
      heading: "建立可持续发展的生态系",
      paragraphs: [
        "建立一个可持续发展的生态系，是我们的长期愿景。",
        "我们的目标不只是推出一个 NFT 系列。",
        "HANSOME: Alpacas vs Cougars NFT Mint 所产生的收入，将重新投入 HANSOME 生态系，用于：",
      ],
      investments: [
        "🎮 游戏开发",
        "📢 社群活动与奖励",
        "🤝 营销推广与合作",
        "💧 生态系成长",
      ],
      flywheel: [
        "NFT Mint 收入",
        "游戏开发",
        "更多玩家",
        "更强大的社群",
        "生态系成长",
        "持续开发",
      ],
      closing: [
        "随着生态系持续成长，我们希望为 NFT 持有者与整个 HANSOME 社群创造更多价值。",
        "更强大的生态系会吸引更多玩家。",
        "更多玩家会形成更健康的社群。",
        "更健康的社群会支持未来的持续开发。",
        "这就是我们正在建立的成长飞轮。",
      ],
    },
    longTermVision: {
      heading: "长期愿景",
      intro: "没有人能保证这一定会成功。但我们期望 HANSOME 走向的样子，是一个循环，而不是一条直线——从一枚迷因币开始，如果一切顺利，最后走到比一枚迷因币大得多的地方。每一个阶段都喂养下一个阶段：",
      lifecycle: [
        { label: "社群", body: "因为觉得这只羊驼好笑而真正参与的人——不只是盯着走势图的旁观者。" },
        { label: "品牌", body: "一个让人真心愿意分享的羊驼识别——迷因、内容，一种值得参与的氛围。" },
        {
          label: "产品",
          body: "等有了愿意支持的观众之后，品牌能撑起的真实产出——周边商品（服饰、玩偶、贴纸）、社群活动、迷因比赛，或许还有联名合作（见「营收策略」）。",
        },
        { label: "营收", body: "来自这些产品、赞助合作，以及 LP 手续费的实际收入——不是空想。" },
        { label: "金库", body: "这些收入以透明、公开、可上链查证的方式累积起来。" },
        { label: "流动性", body: "金库资金依照既定节奏，强化并分散流动性。" },
      ],
      loopLabel: "循环",
      closing:
        "今天的 HANSOME，还处在这个循环最初的阶段——大部分是「社群」，一点点「品牌」，「产品」与「营收」还完全是空白。这不是需要隐藏的失败，只是老实反映一个目前仍然主要是「一只很帅的羊驼，加上一群觉得这件事好笑的人」的项目的真实状态。这份文件会随着情况改变被持续更新——如果没有改变，也会老实承认。",
    },
    faq: {
      heading: "常见问题",
      items: [
        {
          question: "HANSOME 今天实际上做了什么？",
          answer:
            "老实说？就是一只极度帅气的羊驼，加上固定供应量与不可变更合约。今天就只有这样。除此之外的东西——内容、活动、周边商品、合作伙伴关系——都写在上面的「愿景」与「长期愿景」里，是一个方向，不是现在就存在的东西。",
        },
        {
          question: "之后会有周边商品、社群活动或合作伙伴吗？",
          answer:
            "目前都还没有。但如果社群持续成长，这确实是真心的计划——原创内容、社群主办的活动、迷因比赛，之后如果合适的话，还有周边商品（服饰、玩偶、贴纸）与合作伙伴关系。没有日期，没有保证。这件事会不会发生，取决于你们大家有没有让它值得被做出来。",
        },
        {
          question: "为什么金库的余额比宣称的 90% 低？",
          answer:
            "因为 90% 描述的是上线时的初始配额，不是一个固定不变的余额。把金库代币投入官方 Uniswap v4 流动性部位，是「流动性政策」里正常、公开揭露的一部分——不是卖币。所以金库的余额本来就会随着时间下降，因为它里面越来越多的代币变成了流动性，而不是留在那个钱包里不动。实时数字永远都在 /transparency——这份文件只说明背后的政策，也就是为什么它会变动。",
        },
        {
          question: "为什么是 0% 交易税？",
          answer:
            "交易税是一种长期存在的机制，会把每笔交易的一部分转走——通常转进团队控制的钱包。彻底拿掉它，代表每一笔交易都会照报价全额成交，没有任何抽成，也让一整类的信任问题根本不会出现。",
        },
        {
          question: "为什么要不可变更？",
          answer:
            "一份可升级或由管理者控制的合约，等于是承诺「现在的规则以后还会是现在的规则」，但这个承诺背后除了说一说之外没有任何保证。一份没有增发、没有黑名单、没有管理密钥的不可变更合约，让这个承诺从「说出来」变成「结构上就是这样」——代价是以后永远没办法修补任何东西，而这是刻意接受的取舍。",
        },
        {
          question: "如果流动性变成单边怎么办？",
          answer:
            "如果价格往一个方向移动得够远，集中流动性部位确实会完全变成单边——这是预期中的行为，不是故障。发生时，那个特定部位就会在那个方向上失去深度，直到被重新平衡或补充为止。上方「流动性政策」章节说明了规划中的常态后备做法，希望避免变成「没有人能交易」的情况——但截至目前，只有单一部位在运作，这个风险是真实存在、而且我们公开承认的。",
        },
        {
          question: "为什么不直接部署一个新合约？",
          answer:
            "因为目前合约的不可变更性，本身就是信任的来源。为了「修好」某个问题就重新部署合约，等于放弃了这整份文件所建立的唯一保证——不能增发、没有管理者权限、什么都改不了。遇到问题，我们会用金库与流动性政策去解决，而不是整个重来一次。",
        },
      ],
    },
    changelog: {
      heading: "更新记录",
      intro: "这里记录的是这份文件本身的修订历史，不是整个项目的完整历史。",
      entries: [
        {
          version: "v1.7.1",
          date: "2026 年 7 月",
          changes: [
            "经济模型报告新增「长期永续设计」章节（与传统 P2E 比较、固定供应、国库控排放、玩家与生态对齐、羊驼／美洲狮双边经济）。",
          ],
        },
        {
          version: "v1.7",
          date: "2026 年 7 月",
          changes: [
            "新增「GameFi 经济模型」章节，并链接双语数学分析报告与 PDF（排放阶梯、奖池拆分、永续性、双边价值）。",
          ],
        },
        {
          version: "v1.6",
          date: "2026 年 7 月",
          changes: [
            "新增「游戏简介」章节，附上羊驼对美洲狮插图，并提供前往 Game 页面的 CTA。",
            "新增「建立可持续发展的生态系」章节，说明 Mint 收入再投入与生态成长飞轮。",
          ],
        },
        {
          version: "v1.5",

          date: "2026 年 7 月",
          changes: [
            "由金库主导，完成官方 Uniswap v4 资金池的流动性优化：新增两个金库持有的部位——一个窄区间部位用于降低交易滑价，一个宽区间部位提供额外的下跌保护——同时原始锁仓 365 天的部位（#47299）完全维持不变。",
            "更新「流动性政策」章节，反映原本规划中的杠铃型流动性策略现已正式上线，横跨三个金库相关的部位。",
            "新增交易体验改善的说明：交易滑价降低、中大额交易执行效率提升、市场深度改善。",
            "新增近期基础设施改善的说明：交换基础设施、Robinhood Chain 上的 Gas 费用处理、交易可靠性，以及内部流动性管理工具。",
            "扩展「社群」章节，加入 AMA 问答、KOL 合作与持续进行的营销活动，与现有的迷因比赛、抽奖、社群活动并列。",
            "扩展「核心理念」中的「透明公开」项目，明确说明所有流动性操作都在链上进行且可公开查证，项目优先追求长期可持续发展，而不是短期热度。",
          ],
        },
        {
          version: "v1.4",
          date: "2026 年 7 月",
          changes: [
            "正式上架 GeckoTerminal。",
            "正式上架 DexScreener。",
            "送出 CoinGecko 上架申请（审核中）。",
            "送出 CoinMarketCap 上架申请（审核中）。",
            "正式将官方 Uniswap v4 流动性部位（#47299）通过 Titan Locker 锁仓 365 天，将于 2027 年 7 月解锁——对长期流动性做出具体、可上链验证的承诺。",
            "更新路线图里的流动性规划：不再承诺固定新增第二个部位，而是改为持续观察流动性深度，只在交易量与社群成长真的需要时才加入更多流动性。",
            "更新路线图以反映目前的进度。",
            "更新「社群」章节，加入目前活跃的 Telegram 社群、定期迷因比赛、抽奖与社群活动。",
            "全文用字微调与文件内容更新。",
          ],
        },
        {
          version: "v1.3",
          date: "2026 年 7 月",
          changes: [
            "澄清「代币经济学」与「金库政策」：金库的 90% 是上线时的初始配额，不是实时余额。新增明确说明：金库代币会随时间陆续投入官方流动性，金库余额变少代表代币被转换成公开的流动性部位，而不是被卖掉。",
            "移除白皮书里任何写死的「目前余额」数字；每个钱包相关章节现在都指向 /transparency，把它当作实时的第一来源，而不是在这里写一个数字。",
            "新增常见问题：「为什么金库的余额比宣称的 90% 低？」",
            "/transparency 页面本身，现在会实时从合约读取每个官方钱包目前的 HANSOME 余额，与它的初始配额并列显示。",
          ],
        },
        {
          version: "v1.2",
          date: "2026 年 7 月",
          changes: [
            "重新校准「创办人的话」「简介」「愿景」「核心理念」「营收策略」「路线图」「社群」与「长期愿景」章节，让它们符合项目真正的方向：HANSOME 从一枚迷因币开始，但代币的目的是成为一个真正羊驼品牌的起点——如果社群持续成长，会有内容、社群活动、迷因比赛、周边商品与合作伙伴关系——而不是故事的终点。",
            "在「核心理念」新增「代币只是起点」这一项，并新增涵盖周边商品、社群活动、合作伙伴关系，以及 HANSOME 今天实际做了什么的常见问题。",
          ],
        },
        {
          version: "v1.1",
          date: "2026 年 7 月",
          changes: [
            "新增双语支持（英文／简体中文），单一页面搭配语言切换。",
            "新增「创办人的话」「更新记录」与「语言与翻译」章节。",
            "新增中英文两种语言的 PDF 下载版本。",
          ],
        },
        {
          version: "v1.0",
          date: "2026 年 7 月",
          changes: ["首次发布：简介、愿景、核心理念、代币经济学、金库政策、流动性政策、营收策略、路线图、社群、长期愿景与常见问题。"],
        },
      ],
    },
    language: {
      heading: "语言与翻译",
      body: "这份文件提供英文与简体中文两个版本。简体中文版是人工撰写，力求读起来自然通顺，不是机器翻译——如果你发现两个版本在意思上有落差，请以英文版为准，也欢迎让我们知道。之后可能会加入更多语言；这份文件的架构设计，就是为了让新增语言不需要重新制作整个页面。",
    },
    closing: {
      note: "本文件反映 HANSOME ALPACAS 截至发布时的状态，会随项目进展修订，内容不构成投资建议。",
      home: "首页",
      transparency: "透明公开",
      swap: "交易",
    },
  },
};
