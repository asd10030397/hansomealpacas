import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..", "..");

const SECRET_PATTERNS = [
  { name: "private_key_hex", re: /0x[a-fA-F0-9]{64}/g },
  { name: "bip39_mnemonic", re: /\b([a-z]{3,8}\s+){11}[a-z]{3,8}\b/gi },
  { name: "kv_token", re: /KV_REST_API_TOKEN\s*=\s*['"][^'"]+['"]/gi },
  { name: "pinata_jwt", re: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { name: "aws_secret", re: /AKIA[0-9A-Z]{16}/g },
  { name: "vercel_token", re: /vercel_[a-zA-Z0-9]{20,}/g },
  { name: "relayer_key_env", re: /GAME_(MAINNET|TESTNET)_RELAYER_PRIVATE_KEY/gi },
  { name: "vault_key_env", re: /GAME_(MAINNET|TESTNET)_COMMIT_VAULT_KEY/gi },
];

const TEXT_EXT = new Set([
  ".json",
  ".xml",
  ".html",
  ".js",
  ".ts",
  ".txt",
  ".properties",
  ".gradle",
  ".java",
  ".kt",
  ".md",
]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".gradle") continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function scanText(label, content) {
  const hits = [];
  for (const { name, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    const matches = content.match(re);
    if (matches?.length) {
      hits.push({ label, pattern: name, count: matches.length });
    }
  }
  return hits;
}

function scanApkStrings(apkPath) {
  const hits = [];
  try {
    const jarList = execSync(`jar tf "${apkPath}"`, { encoding: "utf8" });
    const interesting = jarList
      .split(/\r?\n/)
      .filter((f) => /\.(json|xml|html|js|properties|txt)$/i.test(f));
    for (const entry of interesting) {
      try {
        const buf = execSync(`jar xf "${apkPath}" "${entry}"`, { cwd: process.cwd(), stdio: "pipe" });
        void buf;
      } catch {
        /* ignore extract errors */
      }
    }
    // Scan extracted assets in apk via strings on whole zip
    const raw = readFileSync(apkPath);
    const ascii = raw.toString("latin1");
    hits.push(...scanText("apk-binary", ascii));
  } catch (err) {
    hits.push({ label: "apk-scan-error", pattern: String(err), count: 1 });
  }
  return hits;
}

const targets = [
  path.join(root, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
  path.join(root, "android", "app", "src", "main", "assets"),
  path.join(root, "www"),
  path.join(root, "capacitor.config.ts"),
];

const allHits = [];
for (const target of targets) {
  if (!existsSync(target)) continue;
  if (statSync(target).isFile() && target.endsWith(".apk")) {
    allHits.push(...scanApkStrings(target));
    continue;
  }
  if (statSync(target).isFile()) {
    const ext = path.extname(target);
    if (!TEXT_EXT.has(ext)) continue;
    allHits.push(...scanText(target, readFileSync(target, "utf8")));
    continue;
  }
  for (const file of walk(target)) {
    const ext = path.extname(file);
    if (!TEXT_EXT.has(ext)) continue;
    try {
      allHits.push(...scanText(file, readFileSync(file, "utf8")));
    } catch {
      /* skip binary */
    }
  }
}

// Filter false positives: public RPC URLs and package names are OK
const filtered = allHits.filter((h) => {
  if (h.pattern === "private_key_hex" && h.count > 0) {
    // Capacitor/android may contain random hex — flag for manual review only if in source files
    return h.label.includes("assets") || h.label.includes("www") || h.label.endsWith(".ts");
  }
  return true;
});

const report = {
  scannedAt: new Date().toISOString(),
  targets,
  hits: filtered,
  verdict: filtered.length === 0 ? "PASS" : "REVIEW",
};

console.log(JSON.stringify(report, null, 2));
