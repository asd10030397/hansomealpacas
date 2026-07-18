/**
 * Generates the bilingual (English + Traditional Chinese) HANSOME Alpacas
 * Player Guide PDF for NFT buyers / players.
 *
 *   node scripts/generate-player-guide-pdf.mjs
 *
 * Source of truth for all rules/numbers: docs/HANSOME_GDS_v1.1_en.md.
 * Self-contained: embeds all pixel art as base64 and renders a single HTML
 * document to PDF with Playwright's bundled Chromium. Does NOT modify the
 * game, the trait pipeline, or the final collection.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => path.join(rootDir, p);
const OUT_DIR = R("public/docs");
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_PDF = path.join(OUT_DIR, "HANSOME_Alpacas_Player_Guide_Bilingual.pdf");

const dataUri = (buf, mime = "image/png") => `data:${mime};base64,${buf.toString("base64")}`;
const fileUri = (p) => dataUri(fs.readFileSync(R(p)));

// A clean "Common" alpaca: a base archetype on the plain meadow background (no class accents).
async function commonComposite() {
  const bg = await sharp(R("public/pixel/traits/backgrounds/meadow-green.png")).resize(1024, 1024, { kernel: "nearest" }).png().toBuffer();
  return await sharp(bg).composite([{ input: R("public/pixel/traits/base/normalized/curly.png") }]).png().toBuffer();
}

async function build() {
  const IMG = {
    logo: fileUri("public/logo.png"),
    king: fileUri("public/pixel/genesis/special/001.png"),
    guardian: fileUri("public/pixel/genesis/special/011.png"),
    farmer: fileUri("public/pixel/genesis/special/016.png"),
    lucky: fileUri("public/pixel/genesis/special/021.png"),
    runner: fileUri("public/pixel/genesis/special/026.png"),
    common: dataUri(await commonComposite()),
    special21: fileUri("public/pixel/genesis/special/_SPECIAL-REVIEW.png"),
    cougar: fileUri("public/pixel/cougar/cougar-official-base.png"),
  };

  const bi = (en, zh) => `<p class="en">${en}</p><p class="zh">${zh}</p>`;
  const sectionHead = (n, en, zh) => `<div class="sec-head"><span class="sec-num">${n}</span><div><h2>${en}</h2><h2 class="zh">${zh}</h2></div></div>`;

  const classes = [
    { key: "king", emoji: "👑", en: "King Alpaca", zh: "王者羊駝", tagEn: "The Ultimate Survivor", tagZh: "終極生存者", supply: 1, tier: "Legendary · 1 of 500",
      abEn: "Permanent immunity to hunting penalty.", abZh: "永久免疫狩獵傷害。", roleEn: "The legendary King of the herd — can safely challenge the most dangerous locations.", roleZh: "羊駝族群中的傳說王者 — 可以安全挑戰最高風險地點。" },
    { key: "guardian", emoji: "🛡️", en: "Guardian Alpaca", zh: "守護者羊駝", tagEn: "The Protector", tagZh: "守護者", supply: 5, tier: "Legendary · 5 of 500",
      abEn: "Hunting penalty rate reduced by 50%.", abZh: "狩獵傷害降低 50%。", roleEn: "Defensive strategy — better survival under pressure.", roleZh: "防禦型策略 — 承受風險能力更高。" },
    { key: "farmer", emoji: "🌾", en: "Farmer Alpaca", zh: "農夫羊駝", tagEn: "The Producer", tagZh: "生產者", supply: 5, tier: "Legendary · 5 of 500",
      abEn: "Effective location reward weight ×1.20 (+20%, normalized).", abZh: "所在地點收益權重 ×1.20（+20%，需歸一化）。", roleEn: "Long-term accumulation — rewards consistent, patient play.", roleZh: "長期累積型 — 適合穩定、耐心的玩家。" },
    { key: "lucky", emoji: "🍀", en: "Lucky Alpaca", zh: "幸運羊駝", tagEn: "The Fortune Seeker", tagZh: "尋運者", supply: 5, tier: "Legendary · 5 of 500",
      abEn: "20% chance to fully avoid the day's hunting penalty.", abZh: "20% 機率完全避免當日狩獵傷害。", roleEn: "High risk, high reward — depends on fortune.", roleZh: "高風險高報酬 — 依靠幸運翻盤。" },
    { key: "runner", emoji: "🏃", en: "Runner Alpaca", zh: "奔跑者羊駝", tagEn: "The Escape Artist", tagZh: "逃脫大師", supply: 5, tier: "Legendary · 5 of 500",
      abEn: "30% chance to escape hunting (penalty = 0).", abZh: "30% 機率逃離狩獵（傷害歸零）。", roleEn: "Fast, aggressive strategy — uses escape ability against hunters.", roleZh: "速度與反制型策略 — 利用逃脫能力反制狩獵。" },
    { key: "common", emoji: "🦙", en: "Common Alpaca", zh: "普通羊駝", tagEn: "The Strategist", tagZh: "策略家", supply: 479, tier: "Common · 479 of 500",
      abEn: "A standard Alpaca without special abilities — skill and strategy still matter.", abZh: "沒有特殊能力的基礎羊駝角色 — 策略與判斷仍然決定結果。", roleEn: "Wins through smart decisions and reading the herd.", roleZh: "靠聰明的決策與判斷取勝。" },
  ];

  const classCard = (c) => `
    <div class="card">
      <div class="card-art"><img src="${IMG[c.key]}" alt="${c.en}"/></div>
      <div class="card-body">
        <div class="card-title"><span class="emoji">${c.emoji}</span><div><h3>${c.en}</h3><h3 class="zh">${c.zh}</h3></div></div>
        <div class="card-tag">"${c.tagEn}" · 「${c.tagZh}」</div>
        <div class="badges"><span class="badge supply">Supply / 供應量 · ${c.supply}</span><span class="badge tier">${c.tier}</span></div>
        <div class="kv"><span class="k">Ability / 能力</span>${bi(c.abEn, c.abZh)}</div>
        <div class="kv"><span class="k">Playstyle / 玩法</span>${bi(c.roleEn, c.roleZh)}</div>
      </div>
    </div>`;

  const locations = [
    { emoji: "🏠", en: "Home", zh: "家園", w: 1, risk: 0, dEn: "The safest location — Cougars cannot enter. Lowest reward.", dZh: "最安全的地點 — 美洲獅無法進入。最低收益。" },
    { emoji: "⛰️", en: "Mountain", zh: "山區", w: 2, risk: 1, dEn: "Low risk, modest reward.", dZh: "低風險，收益偏低。" },
    { emoji: "🌿", en: "Grassland", zh: "草原", w: 3, risk: 2, dEn: "Balanced medium risk and reward.", dZh: "中等風險與收益。" },
    { emoji: "🌲", en: "Forest", zh: "森林", w: 5, risk: 3, dEn: "Higher reward with increased hunting risk.", dZh: "較高收益，同時提高狩獵風險。" },
    { emoji: "🌊", en: "River", zh: "河流", w: 8, risk: 4, dEn: "Highest reward. Highest hunting risk.", dZh: "最高收益。最高狩獵風險。" },
  ];
  const riskMeter = (n) => `<span class="meter">${[0,1,2,3,4].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
  const locRow = (l) => `
    <div class="loc">
      <div class="loc-name"><span class="emoji">${l.emoji}</span><div><b>${l.en}</b> <span class="zh">${l.zh}</span></div></div>
      <div class="loc-meters">
        <div class="mrow"><span class="mlab">Reward / 收益 <b>×${l.w}</b></span>${riskMeter(l.risk === 0 ? 0 : Math.max(1, Math.round(l.w/8*4)))}</div>
        <div class="mrow"><span class="mlab">Risk / 風險</span>${riskMeter(l.risk)}</div>
      </div>
      <div class="loc-desc">${bi(l.dEn, l.dZh)}</div>
    </div>`;

  const phase = (n, emoji, en, zh, dEn, dZh) => `
    <div class="phase">
      <div class="phase-top"><span class="phase-emoji">${emoji}</span><span class="phase-n">${n}</span></div>
      <h3>${en}</h3><h3 class="zh">${zh}</h3>
      ${bi(dEn, dZh)}
    </div>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
  <style>
    :root{
      --bg:#0e1116; --panel:#161c26; --panel2:#1c2431; --line:#2a3444;
      --ink:#eef2f7; --mut:#9fb0c3; --zh:#cdb98a;
      --gold:#e9c46a; --goldD:#c99a3a; --green:#7fc08a; --cyan:#7fd6d6; --violet:#b79cff;
    }
    *{box-sizing:border-box;} 
    html,body{margin:0;padding:0;}
    body{font-family:"Segoe UI","Microsoft JhengHei","Noto Sans TC","PingFang TC",system-ui,sans-serif;
      background:var(--bg); color:var(--ink); font-size:12.5px; line-height:1.5;}
    .zh{font-family:"Microsoft JhengHei","Noto Sans TC","PingFang TC","Segoe UI",sans-serif;}
    p{margin:.28em 0;}
    p.en{color:var(--ink);} p.zh{color:var(--zh);}
    h1,h2,h3{margin:0;line-height:1.25;}
    .page{padding:26px 30px;} 
    .break{break-before:page;}

    /* Cover */
    .cover{min-height:1040px; padding:0; position:relative; overflow:hidden;
      background:radial-gradient(1200px 600px at 80% -10%, rgba(183,156,255,.20), transparent 60%),
                 radial-gradient(1000px 700px at -10% 110%, rgba(127,192,138,.18), transparent 60%),
                 linear-gradient(160deg,#0c0f14 0%, #121a26 60%, #0d141d 100%);}
    .cover-inner{padding:64px 60px;}
    .brandline{display:flex;align-items:center;gap:14px;margin-bottom:40px;}
    .brandline img{height:52px;width:auto;image-rendering:pixelated;filter:drop-shadow(0 4px 10px rgba(0,0,0,.4));}
    .brandline .bn{font-weight:800;letter-spacing:.14em;font-size:15px;color:var(--gold);}
    .cover h1{font-size:56px;font-weight:900;letter-spacing:-.5px;
      background:linear-gradient(92deg,#fff 0%, var(--gold) 60%, var(--goldD) 100%);
      -webkit-background-clip:text;background-clip:text;color:transparent;}
    .cover .vs{font-size:23px;font-weight:800;color:var(--cyan);margin-top:8px;letter-spacing:.06em;}
    .cover .guide{font-size:19px;color:var(--mut);margin-top:22px;font-weight:700;letter-spacing:.05em;}
    .cover .guide b{color:var(--ink);}
    .hero{margin-top:40px;display:grid;grid-template-columns:repeat(5,1fr);gap:12px;}
    .hero figure{margin:0;background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);
      border-radius:14px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,.35);}
    .hero img{width:100%;display:block;image-rendering:pixelated;}
    .hero figcaption{font-size:10.5px;text-align:center;padding:6px 2px;color:var(--mut);font-weight:700;}
    .cover-foot{position:absolute;bottom:34px;left:60px;right:60px;display:flex;justify-content:space-between;
      color:#6f8095;font-size:10.5px;border-top:1px solid var(--line);padding-top:12px;}
    .tagband{margin-top:34px;display:flex;gap:10px;flex-wrap:wrap;}
    .tagband span{background:rgba(233,196,106,.10);border:1px solid rgba(233,196,106,.35);color:var(--gold);
      padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700;}

    /* Sections */
    .sec-head{display:flex;align-items:center;gap:14px;margin:6px 0 14px;}
    .sec-num{flex:0 0 auto;width:38px;height:38px;border-radius:10px;display:grid;place-items:center;
      font-weight:900;font-size:17px;color:#0e1116;background:linear-gradient(180deg,var(--gold),var(--goldD));
      box-shadow:0 6px 16px rgba(233,196,106,.25);}
    .sec-head h2{font-size:20px;font-weight:800;}
    .sec-head h2.zh{font-size:15px;color:var(--zh);font-weight:700;}
    .panel{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);
      border-radius:14px;padding:16px 18px;margin-bottom:14px;}
    .lead p.en{font-size:14px;} 
    .bullets{margin:6px 0 0;padding-left:0;list-style:none;}
    .bullets li{position:relative;padding-left:18px;margin:5px 0;color:var(--mut);}
    .bullets li::before{content:"";position:absolute;left:2px;top:7px;width:7px;height:7px;border-radius:2px;
      background:linear-gradient(180deg,var(--gold),var(--goldD));}
    .bullets li b{color:var(--ink);}

    /* phases */
    .phases{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
    .phase{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);
      border-radius:14px;padding:14px;break-inside:avoid;}
    .phase-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
    .phase-emoji{font-size:22px;}
    .phase-n{font-size:11px;font-weight:800;color:var(--cyan);border:1px solid rgba(127,214,214,.35);
      border-radius:999px;padding:2px 9px;}
    .phase h3{font-size:14px;} .phase h3.zh{font-size:12.5px;color:var(--zh);margin-bottom:4px;}
    .phase p{font-size:11px;} 

    /* locations */
    .loc{display:grid;grid-template-columns:150px 1fr 1.5fr;gap:12px;align-items:center;
      background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);
      border-radius:12px;padding:11px 14px;margin-bottom:9px;break-inside:avoid;}
    .loc-name{display:flex;gap:9px;align-items:center;} .loc-name .emoji{font-size:22px;}
    .loc-name b{font-size:14px;} .loc-name .zh{color:var(--zh);font-size:12px;}
    .mrow{display:flex;align-items:center;gap:8px;margin:2px 0;} 
    .mlab{font-size:10px;color:var(--mut);min-width:112px;} .mlab b{color:var(--gold);}
    .meter{display:inline-flex;gap:3px;} .meter i{width:12px;height:7px;border-radius:2px;background:#33404f;display:block;}
    .meter i.on{background:linear-gradient(90deg,var(--gold),#e76f51);}
    .loc-desc p{font-size:10.5px;margin:.15em 0;}

    /* class cards */
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
    .card{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);
      border-radius:16px;overflow:hidden;display:grid;grid-template-columns:118px 1fr;break-inside:avoid;
      box-shadow:0 8px 22px rgba(0,0,0,.28);}
    .card-art{background:radial-gradient(120px 120px at 50% 40%, rgba(233,196,106,.16), transparent 70%);
      display:grid;place-items:center;border-right:1px solid var(--line);}
    .card-art img{width:118px;height:118px;object-fit:cover;image-rendering:pixelated;}
    .card-body{padding:11px 13px;}
    .card-title{display:flex;gap:8px;align-items:center;}
    .card-title .emoji{font-size:20px;} .card-title h3{font-size:14.5px;} .card-title h3.zh{font-size:12px;color:var(--zh);}
    .card-tag{color:var(--cyan);font-size:11px;font-weight:700;margin:4px 0 7px;}
    .badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
    .badge{font-size:9.5px;font-weight:800;padding:3px 8px;border-radius:999px;}
    .badge.supply{background:rgba(127,192,138,.14);border:1px solid rgba(127,192,138,.4);color:var(--green);}
    .badge.tier{background:rgba(183,156,255,.13);border:1px solid rgba(183,156,255,.4);color:var(--violet);}
    .kv{margin:6px 0;} .kv .k{display:block;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:#7d8ea3;font-weight:800;margin-bottom:1px;}
    .kv p{font-size:10.8px;margin:.1em 0;}

    /* special 21 */
    .s21{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:16px;padding:14px;text-align:center;}
    .s21 img{width:100%;border-radius:10px;display:block;image-rendering:pixelated;}
    .s21 .cap{color:var(--mut);font-size:10.5px;margin-top:8px;}

    /* value / philosophy */
    .value{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
    .value .v{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:14px;padding:13px;break-inside:avoid;}
    .value .v .vi{font-size:22px;margin-bottom:4px;} .value .v h4{margin:0 0 4px;font-size:13px;} .value .v h4 .zh{color:var(--zh);font-weight:700;}
    .value .v p{font-size:10.6px;margin:.1em 0;color:var(--mut);}

    .footer{margin-top:16px;border-top:1px solid var(--line);padding-top:10px;color:#6f8095;font-size:9.8px;display:flex;justify-content:space-between;}
    .note{font-size:9.6px;color:#6f8095;margin-top:6px;}

    /* cougars + earning */
    .cintro{display:flex;gap:16px;align-items:center;}
    .cintro .cbig{font-size:56px;flex:0 0 auto;filter:drop-shadow(0 6px 12px rgba(0,0,0,.4));}
    .cimg{width:170px;height:auto;border-radius:12px;border:1px solid var(--line);image-rendering:pixelated;flex:0 0 auto;box-shadow:0 8px 22px rgba(0,0,0,.4);}
    .cthumb{width:40px;height:40px;object-fit:cover;border-radius:8px;image-rendering:pixelated;border:1px solid var(--line);margin-bottom:4px;}
    .split{display:flex;gap:22px;align-items:center;margin-top:6px;}
    .pie{flex:0 0 auto;width:160px;height:160px;border-radius:50%;position:relative;
      background:conic-gradient(var(--green) 0 288deg, var(--violet) 288deg 324deg, #e76f51 324deg 360deg);
      box-shadow:0 8px 24px rgba(0,0,0,.35);}
    .pie::after{content:"";position:absolute;inset:38px;border-radius:50%;background:var(--panel2);border:1px solid var(--line);}
    .pie .pc{position:absolute;inset:0;display:grid;place-items:center;text-align:center;}
    .pie .pc b{font-size:14px;color:var(--ink);} .pie .pc span{font-size:9px;color:var(--mut);}
    .legend{display:flex;flex-direction:column;gap:10px;flex:1;}
    .legend .li{display:flex;gap:10px;align-items:flex-start;}
    .legend .sw{width:15px;height:15px;border-radius:4px;flex:0 0 auto;margin-top:2px;}
    .legend b{font-size:13px;} .legend .zh{color:var(--zh);font-weight:700;} .legend p{font-size:10.4px;color:var(--mut);margin:.1em 0;}
    .box{margin-top:12px;background:rgba(233,196,106,.07);border:1px solid rgba(233,196,106,.32);border-radius:12px;padding:12px 14px;}
    .box .bt{color:var(--gold);font-weight:800;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px;}
    .box p{font-size:10.6px;margin:.12em 0;}
  </style></head>
  <body>

  <!-- COVER -->
  <section class="cover">
    <div class="cover-inner">
      <div class="brandline"><img src="${IMG.logo}"/><span class="bn">HANSOME ALPACAS</span></div>
      <h1>HANSOME Alpacas</h1>
      <div class="vs">Alpacas vs Cougars · 羊駝 對 美洲獅</div>
      <div class="guide"><b>Player Guide</b> / 玩家指南</div>
      <div class="tagband"><span>Blockchain Strategy Survival</span><span>區塊鏈策略生存</span><span>500 Genesis Alpacas</span><span>Robinhood Chain</span></div>
      <div class="hero">
        <figure><img src="${IMG.king}"/><figcaption>👑 King</figcaption></figure>
        <figure><img src="${IMG.guardian}"/><figcaption>🛡️ Guardian</figcaption></figure>
        <figure><img src="${IMG.farmer}"/><figcaption>🌾 Farmer</figcaption></figure>
        <figure><img src="${IMG.lucky}"/><figcaption>🍀 Lucky</figcaption></figure>
        <figure><img src="${IMG.runner}"/><figcaption>🏃 Runner</figcaption></figure>
      </div>
    </div>
    <div class="cover-foot"><span>NFT Collector & Player Guide · 收藏者與玩家指南</span><span>Consistent with HANSOME GDS v1.1</span></div>
  </section>

  <!-- 1 -->
  <section class="page break">
    ${sectionHead(1, "Game Introduction", "遊戲介紹")}
    <div class="panel lead">
      ${bi(
        "HANSOME Alpacas is a blockchain strategy survival game where NFT Alpacas compete against Cougars through daily strategic decisions.",
        "HANSOME Alpacas 是一款區塊鏈策略生存遊戲，玩家使用 NFT 羊駝角色，透過每日策略選擇與美洲獅對抗。"
      )}
      <ul class="bullets">
        <li><b>NFT Alpacas are playable characters.</b> · NFT 羊駝是可遊玩的角色。</li>
        <li><b>Each Alpaca has a unique identity and gameplay possibilities.</b> · 每隻羊駝都有獨特的身分與策略可能性。</li>
        <li><b>Strategy and risk management determine rewards.</b> · 策略與風險管理決定你的收益。</li>
      </ul>
    </div>

    ${sectionHead(2, "Core Gameplay", "核心玩法")}
    <div class="panel">
      ${bi("Every day is one round. The daily cycle has three phases:", "每天為一個回合。每日循環包含三個階段：")}
      <div class="phases" style="margin-top:10px">
        ${phase("01","🔒","Commit Phase","提交階段","Players secretly choose a location. After commitment, the choice cannot be changed.","玩家秘密選擇地點。提交後無法修改。")}
        ${phase("02","🔎","Reveal Phase","揭示階段","All choices are revealed and hunting results are calculated.","所有玩家揭示選擇，系統計算狩獵結果。")}
        ${phase("03","🎁","Reward Phase","獎勵階段","Players receive rewards based on location, strategy, and gameplay class.","玩家根據地點選擇、策略以及角色能力獲得獎勵。")}
      </div>
    </div>
  </section>

  <!-- 3 -->
  <section class="page break">
    ${sectionHead(3, "Locations", "遊戲地點")}
    <div class="panel">
      ${bi("Five locations, each balancing reward against hunting risk. Higher reward means higher danger from Cougars.","五個地點，各自在收益與狩獵風險之間取得平衡。收益越高，遭遇美洲獅的危險也越高。")}
      <div style="margin-top:10px">
        ${locations.map(locRow).join("")}
      </div>
      <p class="note">Location names, reward weights and risk order follow HANSOME GDS v1.1 §5. · 地點名稱、收益權重與風險順序依據 HANSOME GDS v1.1 第 5 章。</p>
    </div>
  </section>

  <!-- 4 -->
  <section class="page break">
    ${sectionHead(4, "Alpaca Gameplay Classes", "羊駝角色分類")}
    <div class="grid">
      ${classes.map(classCard).join("")}
    </div>
  </section>

  <!-- 5 -->
  <section class="page break">
    ${sectionHead(5, "Strategy Examples", "策略示例")}
    <div class="panel">
      <div class="value" style="grid-template-columns:1fr 1fr;">
        <div class="v"><div class="vi">👑</div><h4>King <span class="zh">王者</span></h4>${bi("Can safely challenge dangerous locations.","可以安全挑戰高風險地點。")}</div>
        <div class="v"><div class="vi">🛡️</div><h4>Guardian <span class="zh">守護者</span></h4>${bi("Better survival under pressure.","承受風險能力更高。")}</div>
        <div class="v"><div class="vi">🌾</div><h4>Farmer <span class="zh">農夫</span></h4>${bi("Rewards long-term consistency.","適合長期累積。")}</div>
        <div class="v"><div class="vi">🍀</div><h4>Lucky <span class="zh">幸運</span></h4>${bi("Depends on fortune.","依靠幸運翻盤。")}</div>
        <div class="v"><div class="vi">🏃</div><h4>Runner <span class="zh">奔跑者</span></h4>${bi("Uses escape ability against hunters.","利用逃脫能力反制狩獵。")}</div>
        <div class="v"><div class="vi">🦙</div><h4>Common <span class="zh">普通</span></h4>${bi("Wins through smart decisions.","靠策略取勝。")}</div>
      </div>
    </div>

    ${sectionHead(6, "NFT Philosophy", "NFT 設計理念")}
    <div class="panel">
      ${bi("HANSOME Alpacas are not only collectible images. Each NFT represents a playable character.","HANSOME Alpacas 不只是收藏圖片。每個 NFT 都代表一個可遊玩的角色。")}
      <div class="value" style="margin-top:10px">
        <div class="v"><div class="vi">🎨</div><h4>Visual Identity <span class="zh">獨特外觀</span></h4>${bi("A handcrafted pixel-art alpaca with its own look.","手繪像素風羊駝，擁有專屬的外型。")}</div>
        <div class="v"><div class="vi">⚔️</div><h4>Gameplay Class <span class="zh">遊戲定位</span></h4>${bi("A role that shapes how you survive and earn.","決定你如何生存與獲利的角色定位。")}</div>
        <div class="v"><div class="vi">🧠</div><h4>Strategic Possibilities <span class="zh">策略可能性</span></h4>${bi("Different classes open different strategies.","不同定位帶來不同的策略可能性。")}</div>
      </div>
    </div>
  </section>

  <!-- Special 21 -->
  <section class="page break">
    ${sectionHead("★", "The Special 21", "尊爵 21")}
    <div class="s21">
      <img src="${IMG.special21}"/>
      <div class="cap">${"1 King + 5 Guardian + 5 Farmer + 5 Lucky + 5 Runner — the 21 rarest Alpacas of the Genesis collection."}<br/>1 位王者 + 5 位守護者 + 5 位農夫 + 5 位幸運 + 5 位奔跑者 — Genesis 系列中最稀有的 21 隻羊駝。</div>
    </div>
  </section>

  <!-- 7 · Cougars -->
  <section class="page break">
    ${sectionHead(7, "The Cougars — The Hunters", "美洲獅 — 狩獵者")}
    <div class="panel">
      <div class="cintro">
        <img class="cimg" src="${IMG.cougar}" alt="Cougar"/>
        <div>
          ${bi(
            "HANSOME isn't only Alpacas. Cougars are the predators — a separate collection of 50 hunters. Each day they stalk the map, hunt Alpacas, and claim a share of the daily rewards.",
            "HANSOME 不只有羊駝。美洲獅是掠食者 — 一個獨立的 50 隻獵手系列。牠們每天在地圖上追蹤、狩獵羊駝，並瓜分每日獎勵。"
          )}
          <div class="badges" style="margin-top:8px">
            <span class="badge supply">Supply / 供應量 · 50</span>
            <span class="badge tier">All identical / 全部相同</span>
            <span class="badge tier">No special abilities / 無特殊能力</span>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="kv"><span class="k">One design, fifty hunters / 一種設計，五十隻獵手</span></div>
      ${bi(
        "Every Cougar is the same. There are no Cougar rarity tiers and no special abilities — all 50 share this exact artwork and hunt on equal footing. Your edge comes purely from where you choose to hunt each day.",
        "每一隻美洲獅都一樣。美洲獅沒有稀有度分級，也沒有任何特殊能力 — 全部 50 隻共用這張美術，並在完全相同的條件下狩獵。你的優勢完全取決於每天選擇在哪裡狩獵。"
      )}
    </div>

    <div class="panel">
      <div class="kv"><span class="k">How Cougars Play / 美洲獅怎麼玩</span></div>
      <div class="phases">
        ${phase("01","🎯","Choose a Hunt","選擇狩獵地點","Commit to a huntable location — Mountain, Grassland, Forest, or River. Cougars can never enter Home.","提交一個可狩獵地點 — 山區、草原、森林或河流。美洲獅永遠無法進入家園。")}
        ${phase("02","🔎","Reveal","揭示","Locations are revealed together with everyone else's.","與所有玩家一同揭示地點。")}
        ${phase("03","🩸","Hunt","狩獵結算","If at least one Alpaca is at your location, your hunt succeeds.","只要你的地點至少有一隻羊駝，狩獵即成功。")}
      </div>
      <div class="value" style="grid-template-columns:1fr 1fr;margin-top:12px">
        <div class="v"><div class="vi">🍖</div><h4>Base Pool <span class="zh">基礎獎池</span></h4>${bi("Every valid Cougar shares this equally — even without a catch.","每隻有效參與的美洲獅平均瓜分 — 即使沒抓到也有。")}</div>
        <div class="v"><div class="vi">🏆</div><h4>Hunting Pool <span class="zh">狩獵獎池</span></h4>${bi("Only successful hunters share this. Your cut scales with the number of Alpacas caught.","只有成功狩獵者能瓜分。分得多寡取決於抓到的羊駝數量。")}</div>
      </div>
    </div>
  </section>

  <!-- 8 · Earning -->
  <section class="page break">
    ${sectionHead(8, "How to Earn HANSOME", "如何獲得 HANSOME 代幣")}
    <div class="panel">
      ${bi(
        "Every day, a fixed reward pool of HANSOME is paid from the Game Treasury and split three ways:",
        "每天由「遊戲金庫」撥出一份固定的 HANSOME 獎勵池，並分成三部分："
      )}
      <div class="split">
        <div class="pie"><div class="pc"><div><b>Daily Pool</b><br/><span>每日獎池</span></div></div></div>
        <div class="legend">
          <div class="li"><span class="sw" style="background:var(--green)"></span><div><b>80% · Alpaca Pool <span class="zh">羊駝獎池</span></b><p>Shared by all Alpacas by location weight. · 由所有羊駝依地點權重瓜分。</p></div></div>
          <div class="li"><span class="sw" style="background:var(--violet)"></span><div><b>10% · Cougar Base Pool <span class="zh">美洲獅基礎獎池</span></b><p>Split equally among all Cougars. · 由所有美洲獅平均分配。</p></div></div>
          <div class="li"><span class="sw" style="background:#e76f51"></span><div><b>10% · Hunting Pool <span class="zh">狩獵獎池</span></b><p>For Cougars whose hunt succeeds. · 分給狩獵成功的美洲獅。</p></div></div>
        </div>
      </div>
    </div>

    <div class="value">
      <div class="v"><div class="vi">🦙</div><h4>If you hold an Alpaca <span class="zh">持有羊駝</span></h4>${bi("Your share of the 80% pool grows with your location's reward weight — minus any hunting penalty. Your gameplay class (King, Guardian, Lucky, Runner…) reduces or removes that penalty.","你在 80% 獎池中的分配，隨所選地點的收益權重提高 — 再扣除狩獵懲罰。你的角色定位（王者、守護者、幸運、奔跑者…）能降低或免除該懲罰。")}</div>
      <div class="v"><img class="cthumb" src="${IMG.cougar}" alt="Cougar"/><h4>If you hold a Cougar <span class="zh">持有美洲獅</span></h4>${bi("Every Cougar is equal: earn an equal share of the 10% Base Pool, plus the 10% Hunting Pool whenever your hunt succeeds.","每隻美洲獅一律平等：平均分得 10% 基礎獎池；狩獵成功時再分得 10% 狩獵獎池。")}</div>
      <div class="v"><div class="vi">💰</div><h4>Claiming <span class="zh">領取獎勵</span></h4>${bi("After each day is settled, rewards become claimable — pull them to your wallet anytime. Unclaimed rewards stay with the NFT.","每日結算後，獎勵即可領取 — 隨時提領到錢包。未領取的獎勵會跟著 NFT 一起保留。")}</div>
    </div>

    <div class="box">
      <div class="bt">Honest by design / 誠實設計</div>
      ${bi("Fixed supply of 1,000,000,000 HANSOME — no minting. All rewards come from the Game Treasury, never from inflation.","固定供應 10 億 HANSOME — 不增發。所有獎勵皆來自遊戲金庫，絕不透過通膨產生。")}
      ${bi("There is no guaranteed USD return. Rewards depend on your strategy, participation, and each day's results.","不保證任何美元回報。獎勵取決於你的策略、參與度以及每日的結果。")}
    </div>

    <div class="footer"><span>HANSOME Alpacas · Player Guide / 玩家指南</span><span>Rules consistent with HANSOME GDS v1.1 · 規則依據 HANSOME GDS v1.1</span></div>
  </section>

  </body></html>`;

  // ---- render to PDF ----
  let chromium;
  ({ chromium } = await import("playwright"));
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) {
    console.log("Chromium not found — installing Playwright Chromium...");
    execSync("npx playwright install chromium", { cwd: rootDir, stdio: "inherit" });
    browser = await chromium.launch();
  }
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: OUT_PDF, format: "A4", printBackground: true, margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" } });

  // per-page PNGs (one <section> == one page in this layout)
  const PNG_DIR = path.join(OUT_DIR, "player-guide-png");
  fs.mkdirSync(PNG_DIR, { recursive: true });
  const sections = await page.$$("body > section");
  for (let i = 0; i < sections.length; i++) {
    const p = path.join(PNG_DIR, `player-guide-${String(i + 1).padStart(2, "0")}.png`);
    await sections[i].screenshot({ path: p });
    console.log(`Wrote ${p}`);
  }
  if (process.env.QA) {
    await page.setViewportSize({ width: 900, height: 1200 });
    await page.screenshot({ path: R("tmp-player-guide-QA.png"), fullPage: true });
    console.log("Wrote tmp-player-guide-QA.png (QA only)");
  }
  await browser.close();
  console.log(`Wrote ${OUT_PDF}`);
}

build().catch((e) => { console.error(e); process.exitCode = 1; });
