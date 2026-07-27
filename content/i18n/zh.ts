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
    scan: "Score Scan",
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
        "HANSOME 2.0 白皮书：迷因身分、Scan & Score（开发中）、Explore（规划中）、代币经济学、金库、流动性、路线图与 Legacy GameFi——如实陈述现状，不把 Scan 说成生产环境已上线。",
    },
    nav: {
      onThisPage: "本页目录",
      sections: {
        "founder-letter": "创办人的话",
        introduction: "简介",
        "meme-identity": "迷因身分",
        "brand-hierarchy": "品牌层级",
        "scan-score": "Scan & Score",
        "axes-confidence": "坐标与 Confidence",
        explore: "Explore",
        "hansome-utility": "$HANSOME 效用",
        tokenomics: "代币经济学",
        treasury: "金库政策",
        liquidity: "流动性政策",
        revenue: "营收策略",
        roadmap: "路线图",
        legacy: "Legacy",
        community: "社群",
        "long-term-vision": "长期愿景",
        faq: "常见问题",
        documents: "文件下载",
        changelog: "更新记录",
        language: "语言与翻译",
      },
    },
    backHome: "← hansomealpacas.xyz",
    downloadPdf: "下载白皮书 PDF",
    downloadEconomicModelPdf: "Legacy 经济模型 PDF",
    documentsLibrary: {
      heading: "文件下载",
      blurb:
        "本站 /docs 提供的正式下载档。分享建议用 PDF；在编辑器阅读可用 Markdown。GameFi 经济模型档案属 Legacy 文件。",
      litepaperEn: "白皮书（英文 PDF）",
      litepaperZh: "白皮书（中文 PDF）",
      economicPdfEn: "Legacy — GameFi 经济模型（英文 PDF）",
      economicPdfZh: "Legacy — GameFi 经济模型（中文 PDF）",
      economicMdEn: "Legacy — GameFi 经济模型（英文 Markdown）",
      economicMdZh: "Legacy — GameFi 经济模型（中文 Markdown）",
      openInBrowser: "开启",
    },
    hero: {
      eyebrow: "白皮书 · HANSOME 2.0",
      title: "HANSOME ALPACAS",
      subtitle:
        "Too Hansome to Be Useful. So we built something useful anyway. — 迷因文化、透明度、发现与链上工具。不做做不到的承诺。",
      meta: [
        { label: "链", value: "Robinhood Chain" },
        { label: "总供应量", value: "1,000,000,000 HANSOME" },
        { label: "交易税", value: "0%" },
        { label: "合约", value: "不可变更、无法增发" },
      ],
    },
    statusLabels: {
      live: "已上线",
      inDevelopment: "开发中",
      planned: "规划中",
      conditional: "有条件",
      legacy: "Legacy",
      exploratory: "探索中",
    },
    founderLetter: {
      heading: "创办人的话",
      paragraphs: [
        "Too Hansome to Be Useful. 这就是那个笑话：一只赢了基因乐透、却几乎毫无实用价值的羊驼。我们开始 HANSOME ALPACAS，是因为这件事让我们自己笑了出来——迷因文化本来就允许先荒谬，再谈有没有用。",
        "HANSOME 2.0 是同一个笑话的下一章：Too Hansome to Be Useful. So we built something useful anyway. 不是企业级分析公司，也不是塞满流行术语的白皮书。而是一个迷因品牌，同时认真做透明度、发现与链上工具——Scan、Score，以及之后的 Explore——并把羊驼迷因文化留住。",
        "我们今天能承诺的，仍然比热度简报更窄：固定且无法增发的供应量、不可变更合约、公开钱包，以及诚实的状态标签。HANSOME Scan 与 HANSOME Score 为「开发中」。Explore 为「规划中」。与 Launch 相关的路径为「有条件」。Genesis NFT／羊驼 VS 美洲狮归入 Legacy。我们不会为了听起来更厉害，就把 Scan 说成生产环境已上线。",
        "这份文件是这次转向的公开记录。它说明什么是真的、什么在进行、什么是规划、什么是 Legacy。如果一年后 HANSOME 还在，我们希望原因是真正的社群，愿意跟一只终于学会「稍微有点用」的帅羊驼一起留下来——同时没忘记它首先是个迷因。",
        "谢谢你读到这里。Stay Hansome.",
      ],
      signature: "— HANSOME ALPACAS 团队",
    },
    introduction: {
      heading: "简介／HANSOME 是什么？",
      paragraphs: [
        "HANSOME ALPACAS 是部署于 Robinhood Chain 的迷因优先项目：固定供应、0% 交易税的 ERC-20 $HANSOME，通过 Uniswap v4 集中流动性池与 ETH 交易。身分仍然是那个笑话——Too Hansome to Be Useful——品牌仍然是羊驼迷因文化，不是企业仪表板。",
        "HANSOME 2.0 在迷因之上加上第二层：透明度、发现与链上工具。方向是 Meme + Transparency + Discovery + On-chain Tools。Scan 与 Score 正在建设，让人检视结构性风险与数据完整度，而不把人气当成安全。Explore 规划用于之后的分类与 Trending 发现。这些都不取代迷因——它们只是让迷因多做一点有用的事。",
        "链上今天已经存在的：不可变更、无法增发的 $HANSOME；官方流动性（含 Titan 锁仓部位 #47299）；公开钱包；以及以 /transparency 作为余额实时来源。不作为生产承诺存在的：一套已完成的公开扫描产品。本白皮书的状态标签是刻意写清楚的。",
      ],
      whatIsHansome: {
        heading: "HANSOME 是什么？",
        paragraphs: [
          "HANSOME ALPACAS（代号：HANSOME）是部署在 Robinhood Chain 上、供应量固定、0% 交易税的 ERC-20。核心身分仍是迷因文化：一只极度帅气、从未被设计成「严肃实用产品」的羊驼。",
          "在代币周围，HANSOME 2.0 正在建设可选工具——Scan、Score、Explore，以及有条件的 Launch 路径——并附上清楚的状态标签。代币合约本身不会凭空铸出效用；工具是各自有成熟度的独立产品。Genesis NFT／羊驼 VS 美洲狮 GameFi 记载于 Legacy。",
        ],
      },
    },
    memeIdentity: {
      heading: "迷因身分",
      slogan: "Too Hansome to Be Useful.",
      tagline: "Too Hansome to Be Useful. So we built something useful anyway.",
      paragraphs: [
        "HANSOME 首先是迷因品牌。羊驼、下颌线、毫无用处——那就是文化。工具排第二，是带目的的梗：如果第一波热度过后我们还想留下来，不妨把其他迷因币通常跳过的透明度与发现也做出来。",
        "我们不是要转型成企业级分析公司。Score 不是卖给机构风控台的简报。它是一种 hansome 的方式，去看结构性链上信号、Activity 与 Confidence——同时保留迷因语气。",
      ],
      pillars: [
        {
          title: "Meme",
          body: "文化、笑话、比赛，以及人们真心想分享的吉祥物。如果不好笑了，其他都不重要。",
        },
        {
          title: "Transparency",
          body: "公开钱包、可验证的流动性操作，以及以 /transparency 作为余额实时来源——不是靠气氛。",
        },
        {
          title: "Discovery",
          body: "通过 Explore（规划中）与清楚的 Category／Trending 标签，帮助发现与理解代币——但不贩卖「安全」。",
        },
        {
          title: "On-chain Tools",
          body: "HANSOME Scan & Score（开发中）：结构性信号、Activity 与 Confidence——坐标分离、状态诚实。",
        },
      ],
    },
    brandHierarchy: {
      heading: "品牌层级",
      intro:
        "HANSOME 2.0 是同一个迷因品牌下的一叠具名产品。每一条都有状态标签。请不要把它们压成「App 已经上线」。",
      items: [
        {
          name: "HANSOME Scan",
          statusKey: "inDevelopment",
          status: "开发中",
          body: "检视结构性 Score、Activity 与 Confidence 的扫描界面。不是生产环境已上线的扫描产品。内部 Week／Month 阶段是软性排序，不是交付承诺。",
        },
        {
          name: "HANSOME Score",
          statusKey: "inDevelopment",
          status: "开发中",
          body: "0–100 结构性风险与透明度启发式分数。不是人气、不是价格预测、不是 rug／moon 神谕。永远与 Confidence 一并呈现。",
        },
        {
          name: "HANSOME Explore",
          statusKey: "planned",
          status: "规划中",
          body: "分类、标签与 Trending 的发现界面——在 Scan／Score 足够稳定之后。不属于 Week-1 范围。",
        },
        {
          name: "HANSOME Launch",
          statusKey: "conditional",
          status: "有条件",
          body: "任何与 Launch 相关的产品路径，取决于工具成熟度、社群需求与明确的 go 决策。不是附日期的承诺。",
        },
        {
          name: "Genesis NFT／羊驼 VS 美洲狮",
          statusKey: "legacy",
          status: "Legacy",
          body: "Season-1 GameFi 与 mint 飞轮文件放在 Legacy。为持有者与历史保存——不是 HANSOME 2.0 的主叙事。",
        },
      ],
    },
    scanScore: {
      heading: "HANSOME Scan & Score",
      status: "开发中",
      paragraphs: [
        "HANSOME Scan 是检视界面。HANSOME Score 是 Scan 内呈现的结构性 0–100 输出。两者皆为「开发中」。本白皮书不宣称生产环境已上线的扫描器，不说「现已提供」，也不把用户写成已经依赖一套完成的 Scan 产品。",
        "Score 只衡量结构性／链上风险与透明度信号。它不是人气比赛、不是成交量名气，也不是投资建议。可能存在原型或内部／有限测试；面向公众的成熟度仍属开发中。",
        "内部规划使用的 Week／Month 标签，是工作排序的软性阶段——不是对外的硬性交付日期。",
        "一项进行中的核心 Scan 能力：Uniswap v4 流动性与锁仓情报——因为在 Robinhood Chain 上，「看得到流动性」不等于「看得懂流动性」。",
      ],
      principlesHeading: "Score 原则（不可妥协）",
      principles: [
        "流动性小、持有人少或成交量低 ≠ 自动「不安全」。",
        "流动性规模／滑价是情境与警示——所有权／可抽走风险才可能影响 Score。",
        "数据缺失会降低 Confidence；不会用虚高的 Score 假装安全。",
        "$HANSOME 永远买不到更高的 Score。持有 HANSOME 不会提升其他代币的 Score。",
        "Category、Trending 与付费曝光永远不影响 Score。",
      ],
      v4LockIntelligence: {
        heading: "Uniswap v4 流动性与锁仓情报",
        status: "开发中",
        problem: [
          "主流扫描器在 Robinhood Chain 上，对 Uniswap v4 部位与第三方锁仓合约的可见度可能有限或不完整。这种可见度落差，会让持有人只看到资金池 TVL，却不知道谁能抽走 position NFT、锁仓是否已验证、何时解锁。",
          "HANSOME Scan 正针对这个落差建造工具——不是已完成的通用产品，也不会用「全球第一」这类营销话术。只是一次 hansome 的尝试：把 v4 + 锁仓证据读清楚。",
        ],
        capabilitiesHeading: "规划中的能力（开发中）",
        capabilities: [
          "资金池身分与 Uniswap v4 position NFT／position id",
          "部位所有者（EOA、金库、锁仓合约或其他）",
          "在可扩展的锁仓注册表中识别时显示锁仓名称",
          "附明确标签的锁仓状态（见下方）",
          "可在链上验证时显示解锁日期",
          "锁仓交易证据（有公开浏览器链接时提供）",
          "集中流动性部位的区间内／区间外状态",
          "部位流动性数量作为情境信息",
          "在 UI 与 Score 输入中分离「规模」与「所有权／可抽走风险」",
        ],
        statusesHeading: "明确的锁仓状态",
        statuses: [
          "LOCKED — VERIFIED ON-CHAIN（已锁仓—链上已验证）",
          "UNLOCKED / EOA-CONTROLLED（未锁仓／EOA 可控）",
          "LOCK DETECTED — EXPIRY UNKNOWN（侦测到锁仓—到期日未知）",
          "UNSUPPORTED LOCKER（尚不支持的锁仓）",
          "UNABLE TO DETERMINE（无法判定）",
        ],
        interpretationHeading: "如何解读这些状态",
        interpretation: [
          "未知 ≠ 未锁仓。「UNABLE TO DETERMINE」与「UNSUPPORTED LOCKER」代表工具缺少已验证证据——不代表明天就有人能抽走流动性。",
          "侦测到锁仓 ≠「安全」。没有验证条件、到期日或所有权清晰度的锁仓，仍是不完整信息。务必展示证据。",
          "看得到流动性，不等于看得懂流动性。若抽走控制权不透明，仅凭资金池深度可能带来误导性的安全感。",
        ],
        whyItMatters: [
          "迷因币靠信任剧场活着，也死在信任剧场。只秀很大的流动性数字、却不交代锁仓／所有权脉络，就是那种剧场。我们宁愿用清楚的状态说「我们还不知道」，也不假装安全。",
          "这是我们在 Robinhood Chain 上使用 Uniswap v4 与第三方锁仓（含 Titan）时遇到的可见度问题。小心补上这个落差，正是 Scan 存在的一部分理由。",
        ],
        scoreRelationshipHeading: "与 HANSOME Score 的关系",
        scoreRelationship: [
          "规模 ≠ 锁仓状态 ≠ 所有权／可抽走风险 ≠ 区间状态。产品里必须分开呈现。",
          "流动性小 ≠ 不安全。流动性大 ≠ 安全。",
          "已验证的锁仓状态与所有权／可抽走风险，在证据存在时可纳入结构性 Score。",
          "流动性规模仍属滑价／深度情境与 Activity 相关警示——不是人气加成，也不会因为「小」就自动扣分。",
          "锁仓覆盖不足会降低 Confidence，并可能显示 UNABLE TO DETERMINE／UNSUPPORTED LOCKER——不会凭空写成「未锁仓」或「安全」。",
        ],
        maturityNote:
          "状态：开发中——尚非生产就绪的通用多代币／多锁仓支持。原型路径已侦测到 HANSOME 经 Titan 锁仓的 Uniswap v4 部位 #47299 并附链上证据；扩展成跨代币的通用锁仓注册表仍在建设中。Week／Month 仅为软性阶段——没有硬性交付承诺。",
      },
    },
    axesConfidence: {
      heading: "Activity · Trending · Category · Confidence",
      intro:
        "四个发现坐标，外加 Confidence。它们严格分离。混在一起，就是迷因工具开始不老实的时候。",
      axes: [
        {
          title: "HANSOME Score",
          body: "结构性风险与透明度（0–100）。唯一配称为「Score」的坐标。",
        },
        {
          title: "Activity",
          body: "交易与持有人活跃度：低／中／高。仅供参考。Activity 不是安全。",
        },
        {
          title: "Trending",
          body: "相对动量（随 Explore 规划）。Trending ≠ 更安全。有机 Trending 绝不用付费换排名。",
        },
        {
          title: "Category",
          body: "分类标签（例如 Animal Memes、DeFi、Gaming）。Category 不影响 Score。",
        },
        {
          title: "Confidence",
          body: "数据完整度与样本成熟度（显示在 Score 旁）。Confidence ≠ Score。新币或索引不足的代币，不确定性应反映在这里——而不是化妆成高分。",
        },
      ],
      principlesHeading: "硬性分离",
      principles: [
        "Score ≠ Activity ≠ Trending ≠ Category。",
        "Confidence = 数据完整度／成熟度——不是第二个热度计。",
        "Trending ≠ 更安全。",
        "Category 不影响 Score。",
        "Promoted ≠ 有机 Trending。未来若有付费曝光，必须标示为 Promoted，且绝不可混入有机 Trending 或 Score。",
        "$HANSOME 永远买不到 Score。",
      ],
    },
    explore: {
      heading: "HANSOME Explore",
      status: "规划中",
      paragraphs: [
        "Explore 是规划中的发现层：按 Category／标签浏览，以透明的相对动量逻辑呈现 Trending，若未来存在付费曝光则清楚标示 Promoted。",
        "Explore 依赖 Scan／Score 的稳定性与分类流程。状态为「规划中」——不是 Week-1 承诺，本文件也不把它写成已上线。",
        "在 Explore 出现之前，发现仍可透过社群、列表与图表进行。这样没关系。我们宁愿 Explore 来得晚而诚实，也不要来得早而假。",
      ],
    },
    hansomeUtility: {
      heading: "$HANSOME 效用",
      paragraphs: [
        "$HANSOME 首先仍是迷因代币：固定供应、0% 交易税、不可变更合约、Robinhood Chain。代币合约里没有质押产品，也没有收益机制。",
        "HANSOME 2.0 的效用是生态层级的，不是一份凭空发明的持有者福利清单。代币锚定品牌、金库与流动性；工具（Scan、Score、Explore）围绕同一套文化与透明度标准建造。本白皮书不发明新的 Genesis NFT 持有者权益。",
        "若未来工具使用权、社群计划或品牌产品带来更具体的效用，会以日期与状态标签另行公告——不会在这里默示暗示。",
      ],
      items: [
        {
          title: "迷因与品牌锚点",
          body: "HANSOME ALPACAS 的文化核心——比赛、内容与社群身分。",
        },
        {
          title: "金库与流动性燃料",
          body: "官方钱包与 Uniswap v4 流动性政策（见代币经济学、金库、流动性）。实时余额：/transparency。",
        },
        {
          title: "工具生态（进行中）",
          body: "Scan & Score 开发中；Explore 规划中；Launch 有条件。效用随已上线工具成长——不是靠口号。",
        },
        {
          title: "Legacy GameFi（分开记载）",
          body: "Genesis／羊驼 VS 美洲狮经济仍记载于 Legacy。不是 2.0 的主效用叙事。",
        },
      ],
    },
    gameplayOverview: {
      heading: "游戏简介（Legacy）",
      opening: "LEGACY — HANSOME: Alpacas vs Cougars 不只是一个 NFT 收藏系列。",
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
        "本白皮书仅提供 Legacy 游戏生态的简单介绍。",
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
        body: "本白皮书仅提供高阶 Legacy 概览。",
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
      heading: "GameFi 经济模型（Legacy）",
      intro: [
        "LEGACY — HANSOME：羊驼 VS 美洲狮是部署于 Robinhood Chain 的日结算 GameFi 经济。每日奖励由 GameTreasury 持有的 $HANSOME 支付——并非新铸造。结果取决于参与度、决策、国库健康度与市场条件。本节不承诺获利或固定收益。",
        "完整数学分析——排放阶梯、奖池拆分、羊驼与美洲狮经济、赛局框架、国库跑道，以及相对于典型 P2E 为何朝向长期永续——已另以独立 Legacy 报告公开，供玩家与研究者阅读。",
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
        "奖励为有条件发放。未 Reveal、安全模式（G < Gsafe）或族群失衡都可能减少或取消当日收益。非投资建议。属 Legacy 文件——不是 HANSOME 2.0 的主产品叙事。",
      linksHeading: "Legacy 经济模型文件",
      links: {
        reportEn: "英文报告（Markdown）",
        reportZh: "中文报告（Markdown）",
        pdfEn: "下载 PDF（英文）",
        pdfZh: "下载 PDF（中文）",
        game: "开启游戏",
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
          detail:
            "目前还没有划出正式的开发子预算。HANSOME 2.0 工具（Scan、Score、Explore）是这些资金未来打算支持的产品方向——在预算公开之前，这不是无上限的支出承诺。",
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
        "HANSOME 在设计上就是 0% 交易税，所以不会像早期那些「抽税型」迷因币一样自动产生收入。流动性与 HANSOME 2.0 工具的资金得从真实来源来——不是靠印更多 HANSOME。以下是目前真正在运作的、开发中的，以及仍属探索的。以下没有任何一项是保证会实现的。",
      streams: [
        {
          id: "lp-fees",
          title: "LP 手续费",
          statusKey: "active",
          status: "已上线",
          body: "0.05% 的 Uniswap v4 资金池手续费，是目前唯一已经在运作的收入来源，会随交易量自动增减。它不多，但是真的，也是这份清单里唯一不依赖新上线产品的项目。",
        },
        {
          id: "scan-score-tools",
          title: "Scan & Score 生态",
          statusKey: "inDevelopment",
          status: "开发中",
          body: "链上检视工具是 HANSOME 2.0 的产品方向。任何未来变现（若有）都会另行揭露，且绝不可包含「付费提高 Score」或「付费进入有机 Trending」。今日状态：开发中——不是已上线的营收线。",
        },
        {
          id: "explore-discovery",
          title: "Explore 发现",
          statusKey: "planned",
          status: "规划中",
          body: "若 Explore 上线，标示为 Promoted 的付费曝光（若未来提供）将是唯一付费发现面——绝不可混入 Score 或有机 Trending。Explore 本身仍属规划中。",
        },
        {
          id: "merchandise",
          title: "周边商品",
          statusKey: "exploratory",
          status: "探索中",
          body: "服饰、玩偶、贴纸——对这只吉祥物很自然。目前还没有任何一款真正设计、制作或贩售。我们宁愿等到社群大到真的想要再好好做。",
        },
        {
          id: "partnerships",
          title: "合作伙伴",
          statusKey: "exploratory",
          status: "探索中",
          body: "不预设任何赞助、合作或联名。若出现真正符合品牌的机会，确定后才会公告——不会在这里写成已上线。",
        },
      ],
    },
    roadmap: {
      heading: "路线图 — HANSOME 2.0",
      intro:
        "分阶段路线图，附诚实状态标签。「Week」「Month」指工具工作的软性内部排序阶段——不是对外的硬性交付承诺。有条件项目需要明确的 go 决策。",
      phases: [
        {
          phase: "阶段 0",
          title: "基础（已完成）",
          statusKey: "completed",
          status: "已完成",
          items: [
            { label: "在 Robinhood Chain 部署供应量固定、无法增发、不可变更的 HANSOME 合约", done: true },
            { label: "建立官方 Uniswap v4 ETH/HANSOME 流动性池", done: true },
            { label: "上线官方网站、交易界面与 /transparency 页面", done: true },
            { label: "通过 Titan Locker 锁仓官方 Uniswap v4 LP 部位（#47299）——约 2027-07-15 解锁", done: true },
            { label: "金库主导的流动性优化：在锁仓 NFT 之外运作多个部位", done: true },
            { label: "发布白皮书与 Legacy GameFi 文件", done: true },
          ],
        },
        {
          phase: "阶段 1",
          title: "Scan & Score",
          statusKey: "inDevelopment",
          status: "开发中",
          items: [
            { label: "HANSOME Scan 检视界面——开发中（非生产环境已上线）", done: false },
            { label: "HANSOME Score 结构性启发式分数 + Confidence——开发中", done: false },
            {
              label:
                "Uniswap v4 流动性与锁仓情报 + 可扩展锁仓注册表——开发中（差异化能力；尚非生产就绪的通用多代币支持）",
              done: false,
            },
            { label: "在产品 UX 中维持 Score ≠ Activity ≠ Trending ≠ Category 的分离", done: false },
            { label: "内部 Week／Month 阶段仅供排序——软性标记，不是对外 SLA", done: false },
          ],
        },
        {
          phase: "阶段 2",
          title: "Explore 与分类",
          statusKey: "planned",
          status: "规划中",
          items: [
            { label: "Category／标签分类与人工验证流程——规划中", done: false },
            { label: "HANSOME Explore 发现界面——规划中（在 Scan／Score 稳定之后）", done: false },
            { label: "Trending 采相对动量；Promoted 绝不混入有机 Trending 或 Score", done: false },
          ],
        },
        {
          phase: "阶段 3",
          title: "Launch 路径",
          statusKey: "conditional",
          status: "有条件",
          items: [
            { label: "与 HANSOME Launch 相关的产品工作——有条件：取决于工具成熟度与明确 go 决策", done: false },
            { label: "没有固定上架日期、没有价格目标、没有承诺的交易所结果", done: false },
            { label: "CoinGecko／CoinMarketCap 申请仍属流程事项，不是路线图保证", done: false },
          ],
        },
        {
          phase: "Legacy",
          title: "Genesis NFT／GameFi",
          statusKey: "legacy",
          status: "Legacy",
          items: [
            { label: "羊驼 VS 美洲狮玩法 + GameFi 经济模型保存在 Legacy", done: true },
            { label: "Mint 飞轮文件保存在 Legacy——不是 2.0 主叙事", done: true },
          ],
        },
      ],
    },
    legacy: {
      heading: "Legacy：Genesis NFT + GameFi",
      status: "Legacy",
      intro: [
        "本节保存 Season-1 GameFi 材料：游戏简介、GameFi 经济模型，以及 mint 收入飞轮。相对于 HANSOME 2.0 的迷因＋工具方向，本节标示为 LEGACY。",
        "这里不发明新的 NFT 持有者权益。完整玩法请看 Game；经济数学请看下方链接的 Legacy 经济模型文件。",
      ],
    },
    community: {
      heading: "社群",
      paragraphs: [
        "热度是一次尖峰，社群才是地板。HANSOME 宁愿留下一百个真心觉得羊驼好笑、也在乎诚实状态标签的人，也不想要一万个下周就忘记代号的人。",
        "Telegram 社群持续运作：迷因比赛、抽奖、AMA 与社群活动。营销与 KOL 合作是为了带来值得留下来的人，不是用来遮掩尚未完成的产品。",
        "HANSOME 2.0 对社群的约定没变：迷因文化优先、透明度永远在场，以及用清楚的「开发中／规划中／有条件／Legacy」标签来赢得信任的工具。",
      ],
    },
    sustainableEcosystem: {
      heading: "Mint 飞轮（Legacy）",
      paragraphs: [
        "LEGACY — 围绕 Genesis mint 收入建立可持续 GameFi 生态，是 Season-1 的愿景。",
        "HANSOME: Alpacas vs Cougars NFT Mint 所产生的收入，曾描述为将重新投入 HANSOME 生态系，用于：",
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
        "此飞轮仍作为 Legacy 脉络保存。HANSOME 2.0 的主循环是迷因文化 → 透明度 → 工具 → 发现——不是以 mint 为先的成长。",
        "更强的生态系仍然重要。排序与产品重心已经转移。",
      ],
    },
    longTermVision: {
      heading: "长期愿景",
      intro:
        "没有人能保证这一定会成功。我们想要的形状是一个循环：迷因文化养活诚实，诚实让工具值得信任，工具让发现有用——同时不假装 Scan 已经是生产环境上线产品。",
      lifecycle: [
        { label: "迷因", body: "人们真心分享的羊驼文化——比赛、笑话、身分。" },
        { label: "透明", body: "公开钱包、可验证的 LP 操作，以 /transparency 为实时真相。" },
        { label: "工具", body: "开发中的 Scan & Score——结构性信号 + Confidence。" },
        { label: "发现", body: "规划中的 Explore——Category、Trending；若有付费仅标 Promoted。" },
        { label: "社群", body: "为文化与诚实留下的人，而不只是盯着走势图。" },
        { label: "金库", body: "LP 手续费与未来真实收入，有目的地强化流动性——不是靠印币。" },
      ],
      loopLabel: "循环",
      closing:
        "今天的 HANSOME 仍处在这个循环的早期：迷因身分清楚、链上透明度真实、工具开发中、Explore 规划中、Launch 有条件、GameFi 归入 Legacy。这份文件会随状态改变更新——包括老实承认延期。",
    },
    faq: {
      heading: "常见问题",
      items: [
        {
          question: "什么是 HANSOME 2.0？",
          answer:
            "同一个迷因品牌——Too Hansome to Be Useful——加上工具方向：透明度、发现，以及链上 Scan／Score（开发中）、Explore（规划中）、Launch（有条件）。Genesis GameFi 属 Legacy。",
        },
        {
          question: "HANSOME Scan 现在上线／现已提供了吗？",
          answer:
            "没有——以本白皮书的用语，它不是生产环境已上线产品。HANSOME Scan 与 HANSOME Score 为「开发中」。请勿把原型或测试工作读成完成的公开扫描器。我们对 Scan／Score 避免使用「现已提供」「live scanner」「用户目前可以…」这类说法。",
        },
        {
          question: "HANSOME Score 衡量什么？",
          answer:
            "结构性风险与透明度信号（0–100）。它不是人气、不是价格预测，也不是 rug／moon 神谕。请永远搭配 Confidence（数据完整度）阅读。Score ≠ Activity ≠ Trending ≠ Category。",
        },
        {
          question: "Category 或 Trending 会改变 Score 吗？",
          answer:
            "不会。Category 永远不影响 Score。Trending 不是安全。未来若有 Promoted 曝光，必须清楚标示，且绝不可混入有机 Trending 或 Score。$HANSOME 永远买不到 Score。",
        },
        {
          question: "流动性小或成交量低，代表代币不安全吗？",
          answer:
            "不代表。流动性小、持有人少或成交量低，不会自动变成「不安全」的 Score。规模／滑价是情境；所有权／可抽走风险才是可能影响 Score 的结构性流动性议题。不确定性应反映在 Confidence。",
        },
        {
          question: "什么是 Uniswap v4 流动性与锁仓情报？",
          answer:
            "一项「开发中」的 Scan 能力，针对可见度落差：主流扫描器在 Robinhood Chain 上对 Uniswap v4 + 第三方锁仓的可见度可能有限或不完整。规划输出包括资金池／部位身分、所有者、锁仓名称、明确锁仓状态（LOCKED—VERIFIED ON-CHAIN、UNLOCKED/EOA-CONTROLLED、LOCK DETECTED—EXPIRY UNKNOWN、UNSUPPORTED LOCKER、UNABLE TO DETERMINE）、解锁日期、锁仓交易证据、区间状态，以及规模 vs 可抽走风险。未知 ≠ 未锁仓；侦测到锁仓 ≠ 在未验证条件下就等于安全。原型已侦测 HANSOME Titan #47299；通用多代币／多锁仓支持仍在建设——尚非生产就绪。",
        },
        {
          question: "为什么金库的余额比宣称的 90% 低？",
          answer:
            "因为 90% 描述的是上线时的初始配额，不是固定余额。把金库代币投入官方 Uniswap v4 流动性部位，是「流动性政策」里正常、公开揭露的一部分——不是卖币。实时数字永远在 /transparency。",
        },
        {
          question: "如果流动性变成单边怎么办？",
          answer:
            "如果价格往一个方向移动得够远，集中流动性部位确实会完全变成单边——这是预期行为，不是故障。HANSOME 现在运作多个部位（原始 Titan 锁仓 #47299，加上额外的金库持有区间）作为杠铃型后备。风险仍然真实且公开承认；详见「流动性政策」。",
        },
        {
          question: "为什么是 0% 交易税与不可变更合约？",
          answer:
            "0% 交易税代表成交按报价全额结算、没有抽成。不可变更且没有增发、黑名单或管理密钥，让「我们无法作弊供应量规则」成为结构事实。问题用金库与流动性政策解决——并用诚实上线的工具解决——而不是重新部署一颗新代币。",
        },
        {
          question: "游戏／Genesis NFT 的故事去哪了？",
          answer:
            "在本白皮书的 Legacy 章节。玩法、GameFi 经济与 mint 飞轮都保存在那里，并标示 Legacy。HANSOME 2.0 的主叙事是迷因＋工具。",
        },
      ],
    },
    changelog: {
      heading: "更新记录",
      intro: "这里记录的是这份文件本身的修订历史，不是整个项目的完整历史。",
      entries: [
        {
          version: "v2.0",
          date: "2026 年 7 月",
          changes: [
            "HANSOME 2.0 重写：迷因身分核心（“Too Hansome to Be Useful”／“…So we built something useful anyway”）、带状态标签的品牌层级、Scan & Score（开发中）、坐标与 Confidence 分离、Explore（规划中）、$HANSOME 效用、含有条件 Launch 的分阶段路线图、将 Genesis + GameFi + mint 飞轮移入 Legacy。",
            "在 Scan & Score 下新增 Uniswap v4 流动性与锁仓情报（开发中）：可见度落差表述、规划能力、明确锁仓状态、与 Score 关系（规模 ≠ 锁仓 ≠ 所有权／可抽走 ≠ 区间）、Titan #47299 原型说明、路线图差异化条目 + FAQ。",
            "营收策略改为围绕生态工具；文件下载将 GameFi 经济模型标为 Legacy；FAQ 加入 Score 免责声明；强化文末声明。",
            "保留已核实的代币经济学／金库／流动性事实（10 亿供应、0% 税、不可增发、Robinhood、90/5/5、钱包角色、Uniswap v4、Titan #47299 约 2027-07-15 解锁、实时余额指向 /transparency）。修正过时的「单一部位」FAQ 用语。",
          ],
        },
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
      body: "这份文件提供英文与中文两个版本。中文版是人工撰写，力求读起来自然通顺，不是机器翻译——如果你发现两个版本在意思上有落差，请以英文版为准，也欢迎让我们知道。之后可能会加入更多语言；这份文件的架构设计，就是为了让新增语言不需要重新制作整个页面。",
    },
    closing: {
      note: "本文件反映 HANSOME ALPACAS 截至发布时的状态，会随状态标签变更而修订，内容不构成投资建议。HANSOME Score／Scan（若日后提供）仅为信息性启发式工具——不是投资建议、人气排名或安全保证。加密货币波动极大，请自行研究（DYOR）。本白皮书中的状态标签（开发中、规划中、有条件、Legacy）优先于任何营销简写。",
      home: "首页",
      transparency: "透明公开",
      swap: "交易",
    },
},
};
