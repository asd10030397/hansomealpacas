import type { Messages } from "@/content/i18n/types";

export const zh: Messages = {
  locale: "zh",
  htmlLang: "zh-Hant",
  language: {
    zh: "中文",
    en: "EN",
    toggleLabel: "語言",
  },
  a11y: {
    skipToContent: "跳至內容",
    primaryLinks: "主要連結",
    socialLinks: "社群連結",
    coinAlt: "HANSOME ALPACAS 金幣",
    copyContract: "複製合約地址",
    copiedContract: "已複製",
    copyWebsite: "複製網站網址",
    shareDevice: "分享",
  },
  hero: {
    memeBadge: "MEME COIN",
    tagline: "天生贏家臉，一輩子沒屁用。",
    tickerLabel: "代號",
    ticker: "$HANSOME",
    chain: "Robinhood Chain",
    chainStatus: "（未上線）",
    followX: "追蹤 X",
    buy: "BUY",
    chart: "CHART",
    x: "X",
    telegram: "TELEGRAM",
    website: "官網",
  },
  tokenomics: {
    eyebrow: "TOKENOMICS",
    title: "代幣經濟",
    subtitle: "純迷因幣數學。零稅。零實用承諾。",
    tickerLabel: "代號",
    ticker: "$HANSOME",
    items: [
      { label: "代號", value: "HANSOME", variant: "ticker" },
      { label: "總供應量", value: "1B", secondary: "1,000,000,000 HANSOME" },
      {
        label: "網路",
        valueLines: ["Robinhood", "Chain"],
        badge: "即將推出",
        variant: "network",
      },
      { label: "稅", value: "0%" },
      { label: "流動性", value: "鎖倉", secondary: "規劃中" },
    ],
  },
  buy: {
    title: "BUY $HANSOME",
    subtitle: "在 hansomealpacas.xyz 直接用 ETH 兌換 HANSOME — 由 Uniswap Universal Router 提供。",
    cta: "領取 HANSOME",
    ctaSublabel: "餵飽羊駝們",
    launchingSoon: "即將推出",
    comingSoon: "（即將推出）",
  },
  swap: {
    eyebrow: "SWAP",
    title: "SWAP",
    subtitle: "在 Robinhood Chain 上透過 Uniswap Universal Router 交易 ETH 與 HANSOME。",
    backHome: "首頁",
    connectWallet: "連接錢包",
    switchNetwork: "切換至 ROBINHOOD CHAIN",
    youPay: "支付",
    youReceive: "收到",
    balance: "餘額",
    slippage: "滑點容忍度",
    flipDirection: "切換兌換方向",
    swap: "SWAP",
    swapping: "兌換中…",
    approveToken: "授權 HANSOME",
    approveRouter: "授權 ROUTER",
    addToWallet: "加入 HANSOME 至錢包",
    watchAssetSuccess: "已加入 HANSOME — 請在 MetaMask 確認 Logo 顯示。",
    watchAssetFailed: "無法加入 HANSOME 至錢包。",
    watchAssetRejected: "您已取消加入 HANSOME。",
    viewOnBlockscout: "在 Blockscout 查看",
    viewTx: "查看交易",
    network: "網路",
    status: {
      loading: "交易處理中",
      success: "兌換成功",
      failed: "交易失敗",
      confirming: "等待確認…",
      approvingToken: "正在授權 HANSOME 給 Permit2…",
      approvingPermit2: "正在授權 Universal Router…",
      swapping: "正在提交兌換…",
      swapComplete: "兌換已完成。",
    },
  },
  about: {
    title: "WTF IS HANSOME ALPACAS？",
    subtitle: "HANSOME ALPACAS 是一個社群驅動的迷因幣。",
    blocks: [
      { lines: ["這隻羊駝，天生贏了基因樂透。"], gapAfter: "lg" },
      { lines: ["每個生態都需要一個吉祥物。"], gapAfter: "lg" },
      { lines: ["我們選了最帥的那隻。"], gapAfter: "lg" },
      { lines: ["毛色完美。", "臉型無敵。", "沒有任何一技之長。"], gapAfter: "lg" },
      { lines: ["不是 CT 讓我們出名。"], gapAfter: "md" },
      { lines: ["是帥。"], gapAfter: "none" },
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "常見問題",
    items: [
      {
        question: "HANSOME 是迷因幣嗎？",
        answer: "是，100%。HANSOME ALPACAS 是社群迷因幣——文化第一、氛圍第二、免責聲明永遠在。",
      },
      {
        question: "$HANSOME 是什麼？",
        answer: "迷因幣。一隻超帥的羊駝。一個代號。就這樣。",
      },
      {
        question: "什麼時候上線？",
        answer: "準備在 Robinhood Chain 上線。前往 hansomealpacas.xyz/swap 兌換。",
      },
      {
        question: "在哪裡購買？",
        answer: "上線後在這裡。現在還不行。",
      },
      {
        question: "有空投嗎？",
        answer: "有些好玩的事正在醞釀中……敬請期待未來的社群活動。",
      },
      {
        question: "在哪條鏈？",
        answer: "Robinhood Chain。",
      },
      {
        question: "HANSOME 有任何功能嗎？",
        answer: "現在？就只是很帥。未來的功能與驚喜活動——敬請期待。",
      },
    ],
  },
  contract: {
    eyebrow: "CONTRACT",
    title: "合約地址",
    subtitle: "官方合約地址",
    addressLabel: "官方 CA",
    placeholder: "合約將於上線時公布。",
    comingSoon: "即將推出",
    copied: "COPIED",
    copy: "COPY",
    viewExplorer: "在區塊瀏覽器查看",
    viewOfficialWallets: "View Official Wallets",
    shareOnX: "SHARE ON X",
    copyUrl: "COPY URL",
    copyCa: "COPY CA",
    share: "SHARE",
    copyFailed: "Copy failed. Try again.",
  },
  liveStatus: {
    title: "即時狀態",
    network: "網路",
    token: "代幣",
    supply: "供應量",
    tax: "稅",
    status: "狀態",
    statusPreparing: "準備上線",
    statusLive: "已上線",
  },
  community: {
    eyebrow: "COMMUNITY",
    title: "社群",
    holders: "持有者",
    transactions: "交易",
    liquidity: "流動性",
    marketCap: "市值",
    comingSoon: "即將推出",
  },
  market: {
    eyebrow: "MARKET",
    title: "MARKET STATS",
    subtitle: "GeckoTerminal 即時 HANSOME/ETH 池數據（Robinhood Chain Uniswap v4）。",
    loading: "Loading",
    unavailable: "Market data temporarily unavailable",
    tokenPrice: "HANSOME 價格",
    liquidity: "流動性",
    change24h: "24H 漲跌",
    volume24h: "24H 成交量",
    transactions24h: "24H 交易",
    txBuys: "買",
    txSells: "賣",
    liveRefresh: "每 30 秒自動更新 · 來源：GeckoTerminal",
  },
  footer: {
    tagline: "天生贏家臉，一輩子沒屁用。",
    memeLovers: "為迷因愛好者而生。",
    notFinancialAdvice: "不構成投資建議。",
    stayHansome: "保持帥氣。🦙",
    builtOn: "Built on Robinhood Chain",
    explorer: "區塊瀏覽器",
    transparency: "Transparency",
    litepaper: "Litepaper",
    copyright: "© 2026 HANSOME ALPACAS",
    disclaimer:
      "$HANSOME 為迷因代幣，沒有內在價值，也不保證任何回報。本網站僅供娛樂，不構成投資建議。加密貨幣波動劇烈，請自行研究，只投入可承受損失的資金。",
  },
  transparency: {
    purpose: "用途",
    liquidityPosition: "流動性部位",
    allocation: "分配比例",
    address: "地址",
    copyAddress: "複製地址",
    copied: "已複製",
    viewBlockscout: "在 Blockscout 查看",
  },
  litepaper: {
    meta: {
      title: "白皮書 | HANSOME ALPACAS",
      description:
        "HANSOME ALPACAS 白皮書：創辦人的話、願景、代幣經濟學、金庫政策、流動性政策、營收策略、路線圖與常見問題——今天真正做到的事，以及老實說，我們想帶這隻帥羊駝走向哪裡。",
    },
    nav: {
      onThisPage: "本頁目錄",
      sections: {
        "founder-letter": "創辦人的話",
        introduction: "簡介",
        vision: "願景",
        philosophy: "核心理念",
        tokenomics: "代幣經濟學",
        treasury: "金庫政策",
        liquidity: "流動性政策",
        revenue: "營收策略",
        roadmap: "路線圖",
        community: "社群",
        "long-term-vision": "長期願景",
        faq: "常見問題",
        changelog: "更新紀錄",
        language: "語言與翻譯",
      },
    },
    backHome: "← hansomealpacas.xyz",
    downloadPdf: "下載 PDF",
    hero: {
      eyebrow: "白皮書",
      title: "HANSOME ALPACAS",
      subtitle: "一份公開紀錄，說明這個專案是什麼、不是什麼，以及我們希望帶它走到哪裡——不做我們做不到的承諾。",
      meta: [
        { label: "鏈", value: "Robinhood Chain" },
        { label: "總供應量", value: "1,000,000,000 HANSOME" },
        { label: "交易稅", value: "0%" },
        { label: "合約", value: "不可變更、無法增發" },
      ],
    },
    statusLabels: {
      live: "已上線",
      planned: "規劃中",
      exploratory: "探索中",
    },
    founderLetter: {
      heading: "創辦人的話",
      paragraphs: [
        "我們並不是因為做出了什麼產品才開始 HANSOME ALPACAS。純粹是「一隻贏了基因樂透、卻什麼用都沒有的羊駝」這個想法讓我們自己笑了出來，我們猜也會讓別人笑出來。這一點到現在都沒變。代幣是那個笑話——但它本來就是一個開始，不是全部。",
        "誠實說，計畫是這樣的：HANSOME 從一枚迷因幣開始。如果真的有夠多人因為覺得一隻蠢帥的羊駝很好笑而留下來，我們想把它變成一個真正的品牌——原創內容、社群活動、迷因比賽、周邊商品，或許還有合作夥伴關係。上面這些，一項都還沒發生。我們把這些告訴你，是因為這是真話，不是因為我們明天就能生出來。",
        "我們今天能承諾的，比這個更小、也更樸實：一個永遠不能再增發的固定供應量、一份任何人（包括我們自己）都無法更改的合約，以及每一個碰過這顆代幣的錢包的公開紀錄。我們沒辦法承諾你一件連帽外套。我們能承諾的是一份我們無法作弊的合約，以及日後任何真正的承諾都會清楚寫進這份文件、附上日期——不是在某個群組裡隨口說說就算了。",
        "這份文件是我們目前最接近「計畫」的東西。它說明今天什麼是真的、如果這個社群持續成長我們真心想做什麼、以及這兩者之間的界線在哪裡。遇到我們還沒有答案的地方，我們選擇老實說不知道，而不是硬掰一個聽起來有信心的答案。如果一年後 HANSOME 還在，我們希望原因是有一群真正的社群，覺得這隻羊駝——以及我們圍繞著它建立起來的一切——值得留下來，而不是因為我們在最初把話說得太滿。",
        "謝謝你把這篇讀到這裡。光是這一點，就已經比大部分衝進迷因幣的人多做了一步。",
      ],
      signature: "— HANSOME ALPACAS 團隊",
    },
    introduction: {
      heading: "簡介",
      paragraphs: [
        "HANSOME ALPACAS 一開始就是一枚迷因幣——一隻極度帥氣的羊駝、一個代號、零一技之長——在 Robinhood Chain 上透過 Uniswap v4 集中流動性池與 ETH 交易。它今天背後沒有產品，我們也不打算裝作有。",
        "但代幣從來不是故事的全部。如果 HANSOME 周圍的社群持續成長，我們的計畫是讓品牌跟著一起成長：原創內容、社群主辦的活動、迷因比賽、周邊商品（服飾、玩偶、貼紙這類的），還有合適的話，合作夥伴關係。上面這些，目前一項都不存在。這份文件把這件事講清楚，而不是把一份願望清單包裝成路線圖。",
        "今天真正存在的是：固定且無法增發的供應量、一份沒有任何管理者特權的不可變更合約，以及每一個碰過這顆代幣的錢包的公開紀錄。這份文件的目的，就是老實說清楚今天什麼是事實、什麼只是期望，以及兩者之間的界線在哪裡——讓這個專案的信任建立在紀錄上，而不是說法上。",
      ],
      whatIsHansome: {
        heading: "HANSOME 是什麼？",
        paragraphs: [
          "HANSOME ALPACAS（代號：HANSOME）是一顆部署在 Robinhood Chain 上、供應量固定、0% 交易稅的 ERC-20 代幣。它唯一自稱的身分，就是它誕生的那個笑話：一隻極度帥氣、卻在設計上毫無用途的羊駝。",
          "代幣合約裡沒有質押機制、沒有遊戲、沒有收益機制，也沒有任何寫進合約裡的未來功能承諾——沒有清楚、獨立公告之前，也不會有。這句話講的是合約，不是我們對這個品牌的野心。想知道我們真正想帶它去哪裡，請看下面的「願景」。",
        ],
      },
    },
    vision: {
      heading: "願景",
      paragraphs: [
        "大部分迷因幣的設計就是衝一波然後淡去。我們寧願做那個在第一波熱度退去之後，還在這裡、而且還在成長的版本——就算這代表走得比較慢、講話比較小聲。",
        "誠實說，我們想帶這個專案去的地方是：HANSOME 從一枚迷因幣開始，但代幣是起點，不是終點。如果真的有一個真實的社群，圍繞著這隻荒謬又帥氣的羊駝形成，我們想把它變成一個真正的品牌——原創內容、社群主導的活動、迷因比賽、周邊商品，合適的話再加上合作夥伴關係。不是元宇宙，也不是那種塞滿流行術語的「實用型代幣」白皮書。就只是一隻值得追蹤的羊駝，在 Web3 裡、也在 Web3 之外。",
        "這些都不需要特定的價格、市值或上架某個交易所才能發生——需要的是真正想留在這裡的人。所以順序是：先有一個小而真實的社群，再有一個保守、透明管理的金庫，等到真的有值得建構的東西之後，再在這兩者之上建立品牌。",
      ],
    },
    philosophy: {
      heading: "核心理念",
      pillars: [
        {
          title: "社群優先",
          body: "沒有私募，也沒有賣給場外投資人的私人額度。今天持有 HANSOME 的人，取得代幣的方式跟任何其他人一樣——在公開市場上買進。",
        },
        {
          title: "代幣只是起點",
          body: "HANSOME 是以迷因幣的身分上線的，今天它也確實就只是這樣——我們不會裝作不是。但這不是我們想停下來的地方。如果社群持續成長，我們的打算是在它之上建立一個真正的羊駝品牌：內容、活動、周邊商品、合作夥伴關係。這是一個公開說出來的方向，不是一個附帶交付日期的承諾。",
        },
        {
          title: "0% 交易稅",
          body: "每一筆買賣都按照報價全額成交。沒有暗中抽走一部分轉進某個錢包的隱藏費用，沒有「自動流動性」抽成，代幣合約裡也沒有任何機制會從你的交易中抽走一分一毫。",
        },
        {
          title: "不可變更合約",
          body: "HANSOME 合約沒有任何管理者功能：不能增發、沒有黑名單、不能暫停、不能更改交易稅，也沒有能在部署後改變合約行為的管理金鑰。部署出去的樣子，就是它永遠的樣子。",
        },
        {
          title: "透明公開",
          body: "這個專案涉及的四個錢包——部署錢包、流動性錢包、金庫與創辦人錢包——全部公開，任何時候都能在鏈上查證。詳見下方「金庫政策」章節，以及即時更新的 /transparency 頁面，查看目前地址與餘額。",
        },
        {
          title: "長期思維",
          body: "流動性與金庫支出的決策，是依照事先訂好的原則進行，而不是看今天 Twitter 上發生了什麼就臨時反應。這份文件會逐章說明目前這些原則具體是什麼。",
        },
      ],
    },
    tokenomics: {
      heading: "代幣經濟學",
      diagramCenterLabel: "HANSOME",
      legend: {
        treasury: "金庫",
        liquidity: "流動性",
        founder: "創辦人",
      },
      totalSupply: {
        heading: "總供應量",
        value: "1,000,000,000 HANSOME",
        body: "供應量在部署時就已固定，不會再改變。合約裡沒有增發功能——團隊不能增發，管理者不能增發，任何人都不能增發。",
      },
      distribution: {
        heading: "初始分配（上線當天）",
        body: "這是這個專案三個持有代幣的錢包，在上線第一天的分配方式——不是它們今天各自持有的數字：",
        rows: [
          { label: "流動性", value: "50,000,000 HANSOME（5%）", note: "上線時已存入官方 Uniswap v4 流動性池。" },
          {
            label: "金庫",
            value: "900,000,000 HANSOME（90%）",
            note: "這是它一開始的餘額，不是現在的餘額——詳見下方說明與「金庫政策」，了解後來發生了什麼事。",
          },
          { label: "創辦人", value: "50,000,000 HANSOME（5%）", note: "創辦人配額。" },
        ],
        footnote:
          "以上百分比描述的是上線時的初始分配，不是即時的即時快照。目前餘額會隨時間變動——尤其是金庫，因為代幣會依照下方「金庫政策」與「流動性政策」持續被投入官方流動性。金庫餘額變少，幾乎都代表這些代幣被轉換成一個公開、可驗證的流動性部位，而不是被賣掉。想知道每個錢包現在真正持有多少，請前往 /transparency——那個頁面，而不是這份文件，才是即時的第一來源。",
      },
      whyFixedSupply: {
        heading: "為什麼要固定供應量？",
        body: "增發功能等於是預先承諾規則以後還可以改。徹底拿掉這個功能，代表沒有任何人——包括我們自己——能在專案發展過程中稀釋持有人的權益。這確實是有代價的：這也意味著這個專案永遠沒辦法靠印代幣來解決流動性問題。我們把這個限制視為一個特色，而不是缺陷，它也直接決定了下面「金庫政策」與「流動性政策」的走向。",
      },
    },
    treasury: {
      heading: "金庫政策",
      intro:
        "金庫錢包一開始持有 HANSOME 單一最大的配額——上線時是總供應量的 90%。它今天的餘額比這個數字低，而且會持續隨時間變動，主要原因是把代幣投入官方流動性，本身就是金庫的一項操作（詳見下方）。這一節說明的是政策——金庫的用途，以及決策是怎麼做的。至於金庫現在真正持有多少，永遠請看 /transparency，不是這份文件。它是一個公開可查的單一錢包——目前還沒有拆分成幾個各自訂好固定比例的子帳戶。",
      lines: [
        {
          label: "流動性",
          value: "目前主要用途",
          detail:
            "到目前為止，金庫的支出大部分都用於挹注與加強官方的 Uniswap v4 流動性部位。這也是金庫目前餘額低於初始 90% 配額的主要原因——那些代幣沒有被賣掉，而是轉換成了一個公開、可驗證的流動性部位（詳見 /transparency 上的流動性錢包，以及下方「流動性政策」）。",
        },
        {
          label: "社群",
          value: "規劃中——待定",
          detail: "目前還沒有訂出專門給社群獎勵的固定額度或預算。未來若有任何承諾，會公開宣布，而不是先讓大家自行假設。",
        },
        {
          label: "開發",
          value: "規劃中——待定",
          detail: "目前還沒有劃出開發預算，因為除了核心代幣與網站之外，暫時沒有其他需要資金的產品路線圖。若情況改變，會重新檢視這一項。",
        },
        {
          label: "團隊",
          value: "見創辦人配額",
          detail: "唯一與團隊相關的配額，就是創辦人錢包（50,000,000 HANSOME，5%）。金庫裡沒有另外設立額外的團隊基金。",
        },
      ],
      transparencyHeading: "透明公開",
      transparencyBody:
        "上面提到的每一個錢包都是公開的。地址，以及 Uniswap v4 資金池／部位的細節，列在下方；目前餘額則是從合約即時讀取，顯示在 /transparency 頁面。那個頁面，而不是這份文件，才是每個錢包現在真正持有多少的第一來源——下面列出的數字，是每個錢包上線時的初始配額，不是即時數字。",
      wallets: [
        { title: "部署錢包", purpose: "合約部署與技術操作。", allocation: "初始配額：0%" },
        { title: "流動性錢包", purpose: "官方 Uniswap v4 流動性管理。", allocation: "初始 LP 存入：50,000,000 HANSOME + 0.075 ETH" },
        {
          title: "金庫",
          purpose: "金庫、生態發展、合作夥伴關係、未來流動性、行銷與開發。",
          allocation: "初始配額：900,000,000 HANSOME（90%）——目前餘額較低，詳見 /transparency",
        },
        { title: "創辦人錢包", purpose: "創辦人配額。", allocation: "初始配額：50,000,000 HANSOME（5%）" },
      ],
      viewWallets: "查看即時錢包地址與餘額 →",
    },
    liquidity: {
      heading: "流動性政策",
      concentratedLiquidity: {
        heading: "集中流動性",
        body: "HANSOME 透過 Uniswap v4 資金池以集中流動性的方式交易：資金被投入一段設定好的價格區間，而不是覆蓋從 0 到無限大的整條曲線。這讓區間內的每一分流動性都能發揮更大的效果，代價是一旦價格移出這個區間，部位就會完全變成單邊。這個取捨是刻意為之，不是意外——這也代表流動性的深度是一項政策決定，不是設定好就不管的預設值。",
      },
      longTermStrategy: {
        heading: "長期 LP 策略",
        body: "目前的做法偏好維持少數幾個容易理解的部位，而不是不斷微調。我們期望的長期結構是「杠鈴型」：一個靠近目前價格、資金效率較高的窄區間部位，再加上至少一個更寬或全區間的部位作為常態後備，確保單一一筆大額交易永遠無法把某個方向的可交易流動性完全耗盡。截至目前，這個專案只運作單一部位；後備部位是規劃中、尚未部署的項目。",
      },
      lpFees: {
        heading: "LP 手續費",
        body: "資金池收取 0.05% 的交易手續費，會累積給目前持有流動性部位的一方——目前是金庫。這筆手續費是真實、獨立於任何代幣稅之外的鏈上收入，我們的目標是定期把它領出來、再投入流動性，而不是讓它一直閒置不動。",
      },
      multiplePositions: {
        heading: "多個 LP 部位",
        body: "單一集中流動性部位在每個方向上都有明確的容量上限。同時運作多個部位——分布在不同價格區間、甚至來自不同資金來源——是有經驗的集中流動性操作者，避免單一部位變成單點故障的標準做法。這是 HANSOME 已經確定的設計方向，但目前規劃中、尚未實作。",
      },
      noReactiveChasing: {
        heading: "為什麼我們不會用反應式流動性追著價格跑",
        body: "每次出現大額交易後立刻反應式地補流動性，通常只是把補進去的部分讓下一筆大額交易吃掉——那是踏輪機，不是策略。我們的做法是提前依照預期的活動量規劃流動性，並綁定在比較持久的里程碑上（例如穩定維持在某個市值區間），而不是看最新的頭條新聞或最近一次的恐慌行情臨時反應。",
      },
    },
    revenue: {
      heading: "營收策略",
      intro:
        "HANSOME 在設計上就是 0% 交易稅，所以不會像早期那些「抽稅型」迷因幣一樣自動產生收入。未來要挹注流動性、或是真正把「願景」裡提到的品牌做出來，資金得從真實的地方來——不是靠印更多 HANSOME。以下是目前真正在運作的，以及如果情況持續成長，我們想推動起來的。以下沒有任何一項是保證會實現的。",
      streams: [
        {
          id: "lp-fees",
          title: "LP 手續費",
          statusKey: "active",
          status: "已上線",
          body: "0.05% 的 Uniswap v4 資金池手續費，是目前唯一已經在運作的收入來源，會隨交易量自動增減。它不多，但是真的，也是這份清單裡唯一一項我們不需要等待就已經在發生的事。",
        },
        {
          id: "merchandise",
          title: "周邊商品",
          statusKey: "exploratory",
          status: "探索中",
          body: "服飾、玩偶、貼紙——對一隻這麼帥的吉祥物來說，周邊商品是很自然的方向，而且它是長期計畫裡真實的一部分，不只是隨口寫上去的項目。目前還沒有任何一款真正設計、製作或販售。我們寧願等到社群大到真的想要它的時候再好好做，也不想為了趕時間推出一件沒人要的連帽外套。",
        },
        {
          id: "partnerships",
          title: "合作夥伴",
          statusKey: "exploratory",
          status: "探索中",
          body: "目前沒有任何贊助、合作或聯名關係存在。如果真的出現合適的機會——真正符合這個品牌、而不只是花錢買一則宣傳貼文——我們會認真考慮，並在確定之後才對外公布。目前還沒有。",
        },
        {
          id: "ecosystem-products",
          title: "未來生態產品",
          statusKey: "exploratory",
          status: "探索中",
          body: "目前沒有規劃或開發中的額外產品（工具、聯名、限量發售等）。隨著品牌這一側逐漸成長——內容、社群活動、迷因比賽——其中有些可能會變成真正能帶來收入的東西。目前還沒有，我們刻意把這一類留白，而不是用一堆空想的功能點子把它填滿。",
        },
      ],
    },
    roadmap: {
      heading: "路線圖",
      phases: [
        {
          phase: "第一階段",
          title: "打好基礎",
          statusKey: "completed",
          status: "已完成",
          items: [
            { label: "部署供應量固定、無法增發、不可變更的 HANSOME 合約", done: true },
            { label: "建立官方的 Uniswap v4 ETH/HANSOME 流動性池", done: true },
            { label: "上線官方網站、交易介面與 /transparency 頁面", done: true },
            { label: "發布這份白皮書", done: true },
          ],
        },
        {
          phase: "第二階段",
          title: "站穩腳步、聽社群的話",
          statusKey: "inProgress",
          status: "進行中",
          items: [
            { label: "被 DEX 資訊聚合平台收錄（GeckoTerminal、DexScreener）", done: true },
            { label: "送出更廣泛上架平台的申請（CoinGecko、CoinMarketCap）——狀態：待定，尚未確認", done: false },
            { label: "部署第二個更寬區間的流動性部位，作為常態後備", done: false },
            { label: "開始定期領取並回收 LP 手續費", done: false },
            { label: "圍繞品牌、而不是價格目標，培養早期社群", done: false },
          ],
        },
        {
          phase: "第三階段",
          title: "維持下去、把品牌做起來",
          statusKey: "future",
          status: "未來規劃",
          items: [
            { label: "評估真實、已公開的營收來源（見「營收策略」），視實際情況推進", done: false },
            { label: "把里程碑式的流動性補充機制正式訂成規則", done: false },
            { label: "探索讓社群在金庫與流動性決策上真正擁有發言權", done: false },
            { label: "如果社群真的在這裡，開始把品牌做成不只是一張走勢圖——內容、社群活動、迷因比賽", done: false },
            { label: "等有了真正的社群可以服務之後，探索周邊商品（服飾、玩偶、貼紙）與合作夥伴關係", done: false },
            { label: "沒有固定日期、沒有承諾的交易所上架、沒有價格目標——這個階段是方向，不是合約", done: false },
          ],
        },
      ],
    },
    community: {
      heading: "社群",
      paragraphs: [
        "熱度是一次尖峰，社群才是地板。一波熱潮可以在很短時間內帶來大量關注，也可以同樣快速地把這些關注全部帶走，什麼都不留下。社群——就算規模很小——才是在圖表停止跳動之後，還會留下來在乎這件事的人。",
        "這個專案寧願有一百個真心覺得吉祥物好笑、並且願意留下來的人，也不想要一萬個下週就忘記代號的人。這份文件裡的每一項政策——金庫的自律、流動性的做法、老實區分什麼是真的、什麼只是方向——說到底都是為了同一個目標：給一個真實的社群，以及日後跟這個社群一起打造出來的真正品牌，一個值得參與的理由。",
      ],
    },
    longTermVision: {
      heading: "長期願景",
      intro: "沒有人能保證這一定會成功。但我們期望 HANSOME 走向的樣子，是一個循環，而不是一條直線——從一枚迷因幣開始，如果一切順利，最後走到比一枚迷因幣大得多的地方。每一個階段都餵養下一個階段：",
      lifecycle: [
        { label: "社群", body: "因為覺得這隻羊駝好笑而真正參與的人——不只是盯著走勢圖的旁觀者。" },
        { label: "品牌", body: "一個讓人真心願意分享的羊駝識別——迷因、內容，一種值得參與的氛圍。" },
        {
          label: "產品",
          body: "等有了願意支持的觀眾之後，品牌能撐起的真實產出——周邊商品（服飾、玩偶、貼紙）、社群活動、迷因比賽，或許還有聯名合作（見「營收策略」）。",
        },
        { label: "營收", body: "來自這些產品、贊助合作，以及 LP 手續費的實際收入——不是空想。" },
        { label: "金庫", body: "這些收入以透明、公開、可上鏈查證的方式累積起來。" },
        { label: "流動性", body: "金庫資金依照既定節奏，強化並分散流動性。" },
      ],
      loopLabel: "循環",
      closing:
        "今天的 HANSOME，還處在這個循環最初的階段——大部分是「社群」，一點點「品牌」，「產品」與「營收」還完全是空白。這不是需要隱藏的失敗，只是老實反映一個目前仍然主要是「一隻很帥的羊駝，加上一群覺得這件事好笑的人」的專案的真實狀態。這份文件會隨著情況改變被持續更新——如果沒有改變，也會老實承認。",
    },
    faq: {
      heading: "常見問題",
      items: [
        {
          question: "HANSOME 今天實際上做了什麼？",
          answer:
            "老實說？就是一隻極度帥氣的羊駝，加上固定供應量與不可變更合約。今天就只有這樣。除此之外的東西——內容、活動、周邊商品、合作夥伴關係——都寫在上面的「願景」與「長期願景」裡，是一個方向，不是現在就存在的東西。",
        },
        {
          question: "之後會有周邊商品、社群活動或合作夥伴嗎？",
          answer:
            "目前都還沒有。但如果社群持續成長，這確實是真心的計畫——原創內容、社群主辦的活動、迷因比賽，之後如果合適的話，還有周邊商品（服飾、玩偶、貼紙）與合作夥伴關係。沒有日期，沒有保證。這件事會不會發生，取決於你們大家有沒有讓它值得被做出來。",
        },
        {
          question: "為什麼金庫的餘額比宣稱的 90% 低？",
          answer:
            "因為 90% 描述的是上線時的初始配額，不是一個固定不變的餘額。把金庫代幣投入官方 Uniswap v4 流動性部位，是「流動性政策」裡正常、公開揭露的一部分——不是賣幣。所以金庫的餘額本來就會隨著時間下降，因為它裡面越來越多的代幣變成了流動性，而不是留在那個錢包裡不動。即時數字永遠都在 /transparency——這份文件只說明背後的政策，也就是為什麼它會變動。",
        },
        {
          question: "為什麼是 0% 交易稅？",
          answer:
            "交易稅是一種長期存在的機制，會把每筆交易的一部分轉走——通常轉進團隊控制的錢包。徹底拿掉它，代表每一筆交易都會照報價全額成交，沒有任何抽成，也讓一整類的信任問題根本不會出現。",
        },
        {
          question: "為什麼要不可變更？",
          answer:
            "一份可升級或由管理者控制的合約，等於是承諾「現在的規則以後還會是現在的規則」，但這個承諾背後除了說一說之外沒有任何保證。一份沒有增發、沒有黑名單、沒有管理金鑰的不可變更合約，讓這個承諾從「說出來」變成「結構上就是這樣」——代價是以後永遠沒辦法修補任何東西，而這是刻意接受的取捨。",
        },
        {
          question: "如果流動性變成單邊怎麼辦？",
          answer:
            "如果價格往一個方向移動得夠遠，集中流動性部位確實會完全變成單邊——這是預期中的行為，不是故障。發生時，那個特定部位就會在那個方向上失去深度，直到被重新平衡或補充為止。上方「流動性政策」章節說明了規劃中的常態後備做法，希望避免變成「沒有人能交易」的情況——但截至目前，只有單一部位在運作，這個風險是真實存在、而且我們公開承認的。",
        },
        {
          question: "為什麼不直接部署一個新合約？",
          answer:
            "因為目前合約的不可變更性，本身就是信任的來源。為了「修好」某個問題就重新部署合約，等於放棄了這整份文件所建立的唯一保證——不能增發、沒有管理者權限、什麼都改不了。遇到問題，我們會用金庫與流動性政策去解決，而不是整個重來一次。",
        },
      ],
    },
    changelog: {
      heading: "更新紀錄",
      intro: "這裡記錄的是這份文件本身的修訂歷史，不是整個專案的完整歷史。",
      entries: [
        {
          version: "v1.3",
          date: "2026 年 7 月",
          changes: [
            "澄清「代幣經濟學」與「金庫政策」：金庫的 90% 是上線時的初始配額，不是即時餘額。新增明確說明：金庫代幣會隨時間陸續投入官方流動性，金庫餘額變少代表代幣被轉換成公開的流動性部位，而不是被賣掉。",
            "移除白皮書裡任何寫死的「目前餘額」數字；每個錢包相關章節現在都指向 /transparency，把它當作即時的第一來源，而不是在這裡寫一個數字。",
            "新增常見問題：「為什麼金庫的餘額比宣稱的 90% 低？」",
            "/transparency 頁面本身，現在會即時從合約讀取每個官方錢包目前的 HANSOME 餘額，與它的初始配額並列顯示。",
          ],
        },
        {
          version: "v1.2",
          date: "2026 年 7 月",
          changes: [
            "重新校準「創辦人的話」「簡介」「願景」「核心理念」「營收策略」「路線圖」「社群」與「長期願景」章節，讓它們符合專案真正的方向：HANSOME 從一枚迷因幣開始，但代幣的目的是成為一個真正羊駝品牌的起點——如果社群持續成長，會有內容、社群活動、迷因比賽、周邊商品與合作夥伴關係——而不是故事的終點。",
            "在「核心理念」新增「代幣只是起點」這一項，並新增涵蓋周邊商品、社群活動、合作夥伴關係，以及 HANSOME 今天實際做了什麼的常見問題。",
          ],
        },
        {
          version: "v1.1",
          date: "2026 年 7 月",
          changes: [
            "新增雙語支援（英文／繁體中文），單一頁面搭配語言切換。",
            "新增「創辦人的話」「更新紀錄」與「語言與翻譯」章節。",
            "新增中英文兩種語言的 PDF 下載版本。",
          ],
        },
        {
          version: "v1.0",
          date: "2026 年 7 月",
          changes: ["首次發布：簡介、願景、核心理念、代幣經濟學、金庫政策、流動性政策、營收策略、路線圖、社群、長期願景與常見問題。"],
        },
      ],
    },
    language: {
      heading: "語言與翻譯",
      body: "這份文件提供英文與繁體中文兩個版本。繁體中文版是人工撰寫，力求讀起來自然通順，不是機器翻譯——如果你發現兩個版本在意思上有落差，請以英文版為準，也歡迎讓我們知道。之後可能會加入更多語言；這份文件的架構設計，就是為了讓新增語言不需要重新製作整個頁面。",
    },
    closing: {
      note: "本文件反映 HANSOME ALPACAS 截至發布時的狀態，會隨專案進展修訂，內容不構成投資建議。",
      home: "首頁",
      transparency: "透明公開",
      swap: "交易",
    },
  },
};
