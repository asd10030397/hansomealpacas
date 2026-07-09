import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const ENV_KEYS = [
  "NEXT_PUBLIC_WEBSITE",
  "NEXT_PUBLIC_X",
  "NEXT_PUBLIC_TELEGRAM",
  "NEXT_PUBLIC_CONTRACT",
  "NEXT_PUBLIC_BUY",
  "NEXT_PUBLIC_CHART",
];

const REQUIRED_ASSETS = [
  "public/logo/logo.svg",
  "public/logo/logo-512.png",
  "public/icons/favicon.png",
  "public/images/avatar.png",
  "public/images/og.png",
];

function loadEnvFile() {
  const envPath = join(root, ".env.local");
  const env = { ...process.env };

  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key) env[key.trim()] = rest.join("=").trim();
    }
  }

  return env;
}

function isValidHttpUrl(value) {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function checkRemoteUrl(url) {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    return response.ok || response.status === 405;
  } catch {
    return false;
  }
}

function status(pass) {
  return pass ? "PASS" : "FAIL";
}

async function main() {
  const env = loadEnvFile();
  const results = [];
  let failures = 0;

  const add = (category, name, pass, detail = "") => {
    results.push({ category, name, pass, detail });
    if (!pass) failures += 1;
  };

  console.log("\nKAIRU Release Check\n");

  for (const asset of REQUIRED_ASSETS) {
    const path = join(root, asset);
    add("Assets", asset, existsSync(path));
  }

  for (const key of ENV_KEYS) {
    const value = env[key]?.trim() ?? "";
    const optional = key === "NEXT_PUBLIC_CONTRACT";
    const pass = optional ? true : value.length > 0 ? isValidHttpUrl(value) || value.length > 0 : false;

    if (key.includes("WEBSITE") || key.includes("X") || key.includes("TELEGRAM") || key.includes("CHART") || key.includes("BUY")) {
      add(
        "Environment",
        key,
        value.length === 0 ? true : isValidHttpUrl(value),
        value.length === 0 ? "not set" : value,
      );
    } else {
      add("Environment", key, true, value.length === 0 ? "not set (optional)" : value);
    }
  }

  const contract = env.NEXT_PUBLIC_CONTRACT?.trim() ?? "";
  add("Token", "Contract configured", true, contract ? "configured" : "not set (pre-launch ok)");

  const externalLinks = [
    ["NEXT_PUBLIC_X", env.NEXT_PUBLIC_X],
    ["NEXT_PUBLIC_TELEGRAM", env.NEXT_PUBLIC_TELEGRAM],
    ["NEXT_PUBLIC_BUY", env.NEXT_PUBLIC_BUY],
    ["NEXT_PUBLIC_CHART", env.NEXT_PUBLIC_CHART],
  ];

  for (const [name, url] of externalLinks) {
    if (isValidHttpUrl(url)) {
      const reachable = await checkRemoteUrl(url.trim());
      add("Links", name, reachable, url.trim());
    }
  }

  try {
    const { execSync } = await import("node:child_process");
    execSync("npm run build", { cwd: root, stdio: "pipe" });
    add("Quality", "Production build", true);
  } catch {
    add("Quality", "Production build", false, "npm run build failed");
  }

  const reportLines = [
    "# KAIRU Release Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `| Metric | Result |`,
    `| ------ | ------ |`,
    `| Total checks | ${results.length} |`,
    `| Passed | ${results.filter((r) => r.pass).length} |`,
    `| Failed | ${failures} |`,
    `| Launch ready | ${failures === 0 ? "YES" : "NO"} |`,
    "",
  ];

  const categories = [...new Set(results.map((r) => r.category))];

  for (const category of categories) {
    reportLines.push(`## ${category}`, "");
    for (const result of results.filter((r) => r.category === category)) {
      reportLines.push(`- [${status(result.pass)}] **${result.name}**${result.detail ? ` — ${result.detail}` : ""}`);
    }
    reportLines.push("");
  }

  reportLines.push(
    "## Launch Readiness",
    "",
    "### Website",
    failures === 0 ? "- Complete" : "- Action required before launch",
    "",
    "### Brand",
    "- Mascot finalized",
    "- Assets in `public/logo/`",
    "",
    "### SEO",
    "- robots.txt via `app/robots.ts`",
    "- sitemap.xml via `app/sitemap.ts`",
    "- manifest via `app/manifest.ts`",
    "",
    "### Still missing before public launch",
    "",
  );

  const missing = [];

  if (!isValidHttpUrl(env.NEXT_PUBLIC_WEBSITE ?? "")) missing.push("- Set `NEXT_PUBLIC_WEBSITE`");
  if (!isValidHttpUrl(env.NEXT_PUBLIC_X ?? "")) missing.push("- Set `NEXT_PUBLIC_X`");
  if (!isValidHttpUrl(env.NEXT_PUBLIC_TELEGRAM ?? "")) missing.push("- Set `NEXT_PUBLIC_TELEGRAM`");
  if (!contract) missing.push("- Set `NEXT_PUBLIC_CONTRACT` when token is live");
  if (!isValidHttpUrl(env.NEXT_PUBLIC_BUY ?? "")) missing.push("- Set `NEXT_PUBLIC_BUY`");
  if (!isValidHttpUrl(env.NEXT_PUBLIC_CHART ?? "")) missing.push("- Set `NEXT_PUBLIC_CHART`");

  reportLines.push(...(missing.length ? missing : ["- Nothing critical. Ready to ship."]));

  const reportPath = join(root, "docs", "RELEASE_REPORT.md");
  writeFileSync(reportPath, reportLines.join("\n"));

  for (const result of results) {
    const icon = result.pass ? "✓" : "✗";
    console.log(`${icon} [${result.category}] ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
  }

  console.log(`\nReport written to docs/RELEASE_REPORT.md`);
  console.log(failures === 0 ? "\nRESULT: PASS\n" : `\nRESULT: FAIL (${failures} issues)\n`);

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
