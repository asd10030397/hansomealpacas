import puppeteer from "puppeteer";

const BASE = "https://kairu.lol";

const report = {
  builtOnSolana: false,
  manualClaimEn: false,
  manualClaimZh: false,
  followShareEn: false,
  followShareZh: false,
  communityLink: false,
  analyticsQueue: false,
  pageViewOnce: false,
  ambientWorks: false,
  brokenImages: [],
  consoleErrors: [],
  hydrationWarnings: [],
};

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();

page.on("console", (msg) => {
  const text = msg.text();
  if (msg.type() === "error" && !text.includes("favicon")) report.consoleErrors.push(text);
  if (/hydration/i.test(text)) report.hydrationWarnings.push(text);
});
page.on("pageerror", (err) => report.consoleErrors.push(err.message));

try {
  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 120000 });

  report.communityLink = await page
    .$eval('a[aria-label="Visit KAIRU on X"]', (el) => el.getAttribute("href"))
    .then((href) => href === "https://x.com/DeerloveRu")
    .catch(() => false);

  const html = await page.content();
  const chunk856 = html.match(/856-[a-f0-9]+\.js/)?.[0];
  if (chunk856) {
    const js = await (await fetch(`${BASE}/_next/static/chunks/${chunk856}`)).text();
    report.analyticsQueue = js.includes("n.push({name:e,props:t})") || js.includes("e.push=function");
  }

  await page.evaluate(() => localStorage.removeItem("kairu:deer-vote"));
  await page.reload({ waitUntil: "networkidle0", timeout: 120000 });
  await page.waitForSelector('button[aria-label="EN"]', { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000));

  const events = await page.evaluate(() =>
    (window.dataLayer ?? [])
      .map((entry) => Array.from(entry))
      .filter((args) => args[0] === "event")
      .map((args) => args[1]),
  );
  report.pageViewOnce = events.filter((e) => e === "page_view").length === 1;

  await page.click("body");
  await new Promise((r) => setTimeout(r, 500));
  const ambient = await page.evaluate(() => {
    const audio = [...document.querySelectorAll("audio")][0];
    return {
      hasAudio: Boolean(audio),
      paused: audio ? audio.paused : true,
      src: audio?.currentSrc || audio?.src || null,
    };
  });
  report.ambientWorks =
    ambient.hasAudio &&
    (ambient.src?.includes("/audio/ambient") ?? false) &&
    !ambient.paused;

  const images = await page.$$eval("img[src]", (els) =>
    els.map((el) => ({ src: el.getAttribute("src"), complete: el.complete, nw: el.naturalWidth })),
  );
  for (const img of images) {
    if (!img.complete || img.nw === 0) report.brokenImages.push(img.src);
  }

  await page.click('button[aria-label="EN"]');
  await page.waitForFunction(() => document.querySelector("section#deer-vote button"), {
    timeout: 15000,
  });
  await page.click("section#deer-vote button");
  await new Promise((r) => setTimeout(r, 2500));

  let text = await page.evaluate(() => document.body.innerText);
  report.builtOnSolana = text.includes("Built on Solana");
  report.manualClaimEn =
    text.includes("return to kairu.lol and submit:") &&
    text.includes("Full claim rules will be announced before launch");
  report.followShareEn =
    text.includes("Follow our official X") && text.includes("share your deer identity");

  await page.click('button[aria-label="中文"]');
  await new Promise((r) => setTimeout(r, 500));
  text = await page.evaluate(() => document.body.innerText);
  report.manualClaimZh =
    text.includes("請返回官網提交：") && text.includes("詳細規則將於發幣前公布。");
  report.followShareZh = text.includes("追蹤官方 X") && text.includes("分享你的鹿籍");
  report.builtOnSolana = report.builtOnSolana && text.includes("Built on Solana");

  const resultImages = await page.$$eval("section#deer-vote img[src]", (els) =>
    els.map((el) => ({ src: el.getAttribute("src"), complete: el.complete, nw: el.naturalWidth })),
  );
  for (const img of resultImages) {
    if (!img.complete || img.nw === 0) report.brokenImages.push(img.src);
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}

const pass =
  report.builtOnSolana &&
  report.manualClaimEn &&
  report.manualClaimZh &&
  report.followShareEn &&
  report.followShareZh &&
  report.communityLink &&
  report.analyticsQueue &&
  report.pageViewOnce &&
  report.ambientWorks &&
  report.brokenImages.length === 0 &&
  report.consoleErrors.length === 0 &&
  report.hydrationWarnings.length === 0;

process.exit(pass ? 0 : 1);
