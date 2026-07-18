// Validation for the Special Background class-lock system.
// Enforces:
//   1. Special backgrounds (king/guardian/farmer/lucky/runner) are NOT in the public random pool.
//   2. No Public/Common alpaca uses a special background.
//   3. Each Special-21 token's background matches its Gameplay Class (King->king, etc.).
//   4. The class-lock map is consistent across traits.json and compatibility.json.
// Does NOT generate anything and does NOT touch public NFT generation.
import fs from "node:fs";
import path from "node:path";

const ROOT = "public/pixel/traits";
const METADIR = "public/pixel/genesis/metadata";
const REPORTS = "reports/genesis/final";
fs.mkdirSync(REPORTS, { recursive: true });

const traits = JSON.parse(fs.readFileSync(path.join(ROOT, "traits.json"), "utf8"));
const compat = JSON.parse(fs.readFileSync(path.join(ROOT, "compatibility.json"), "utf8"));
const bgCat = traits.categories.background;
const special = bgCat.specialBackgrounds;
const lock = compat.specialBackgroundClassLock;
const SPECIAL_IDS = special.items.map((i) => i.id);

// canonical class -> background map (from traits.json)
const CLASS_TO_BG = {}; for (const it of special.items) CLASS_TO_BG[it.gameplayClass] = it.id;
const BG_TO_CLASS = {}; for (const [k, v] of Object.entries(CLASS_TO_BG)) BG_TO_CLASS[v] = k;

// reusable rule (exported for the future Special-21 generator)
export function validateSpecialToken({ type, gameplayClass, background }) {
  const errs = [];
  const isSpecialBg = SPECIAL_IDS.includes(background);
  const isSpecial = type === "Legendary" || type === "Reserved";
  if (isSpecialBg && !isSpecial) errs.push(`Common/Public token may not use special background '${background}'.`);
  if (isSpecialBg && isSpecial) {
    if (!gameplayClass) errs.push(`Special token uses special background '${background}' but has no gameplayClass.`);
    else if (CLASS_TO_BG[gameplayClass] !== background) errs.push(`Class '${gameplayClass}' must use '${CLASS_TO_BG[gameplayClass]}' background, not '${background}'.`);
  }
  if (gameplayClass && !CLASS_TO_BG[gameplayClass]) errs.push(`Unknown gameplayClass '${gameplayClass}'.`);
  return { ok: errs.length === 0, errors: errs };
}

function runCli() {
const checks = [];

// 1. special backgrounds excluded from public pool
const poolIds = bgCat.items.map((i) => i.id);
const leaked = SPECIAL_IDS.filter((id) => poolIds.includes(id));
checks.push(["Special backgrounds excluded from public random pool", leaked.length === 0, leaked.length ? `LEAKED: ${leaked}` : "5 special ids absent from background.items"]);
checks.push(["Special backgrounds flagged excludeFromRandomPool", special.excludeFromRandomPool === true, String(special.excludeFromRandomPool)]);
checks.push(["All special items status = special-reserved", special.items.every((i) => i.status === "special-reserved"), special.items.map((i) => i.status).join("/")]);

// 2. artwork files exist
const missing = SPECIAL_IDS.filter((id) => !fs.existsSync(path.join(ROOT, "backgrounds", `${id}.png`)));
checks.push(["All 5 special background PNGs present", missing.length === 0, missing.length ? `missing: ${missing}` : "5/5"]);

// 3. class-lock map consistency (traits.json <-> compatibility.json)
let mapConsistent = true;
for (const [cls, bgId] of Object.entries(CLASS_TO_BG)) if (lock.allowed[cls] !== `background:${bgId}`) mapConsistent = false;
checks.push(["Class-lock map consistent (traits.json ↔ compatibility.json)", mapConsistent && Object.keys(CLASS_TO_BG).length === 5, JSON.stringify(CLASS_TO_BG)]);

// 4. scan generated metadata
let publicChecked = 0, publicUsingSpecial = 0, specialChecked = 0, specialLockErrors = 0;
const picksPath = path.join(REPORTS, "_picks.json");
if (fs.existsSync(picksPath)) {
  const D = JSON.parse(fs.readFileSync(picksPath, "utf8"));
  for (const id of Object.keys(D.picks)) { publicChecked++; if (SPECIAL_IDS.includes(D.picks[id].bg)) publicUsingSpecial++; }
}
// scan any special metadata that already declares a background+class
if (fs.existsSync(METADIR)) {
  for (const f of fs.readdirSync(METADIR).filter((f) => f.endsWith(".json"))) {
    const m = JSON.parse(fs.readFileSync(path.join(METADIR, f), "utf8"));
    const h = m.hansome || {};
    if (h.type === "Legendary" || h.type === "Reserved") {
      if (h.specialBackground || h.gameplayClass) { specialChecked++; const r = validateSpecialToken({ type: h.type, gameplayClass: h.gameplayClass, background: h.specialBackground }); if (!r.ok) specialLockErrors++; }
    }
  }
}
checks.push(["No Public/Common NFT uses a special background", publicUsingSpecial === 0, `${publicChecked} public scanned, ${publicUsingSpecial} violations`]);
checks.push(["Special-21 tokens obey class-lock (where assigned)", specialLockErrors === 0, `${specialChecked} special tokens carry a class/bg so far, ${specialLockErrors} lock errors`]);

// self-test the reusable rule
const cases = [
  [{ type: "Legendary", gameplayClass: "King", background: "king" }, true],
  [{ type: "Legendary", gameplayClass: "Guardian", background: "king" }, false],
  [{ type: "Public", gameplayClass: undefined, background: "king" }, false],
  [{ type: "Public", gameplayClass: undefined, background: "meadow-green" }, true],
  [{ type: "Reserved", gameplayClass: "Runner", background: "runner" }, true],
];
let selfOk = true; for (const [inp, exp] of cases) if (validateSpecialToken(inp).ok !== exp) selfOk = false;
checks.push(["Class-lock rule self-test (5 cases)", selfOk, selfOk ? "all pass" : "FAILED"]);

const allPass = checks.every((c) => c[1]);
let md = `# HANSOME Genesis — Special Background Class-Lock Validation\n\n`;
md += `_Gameplay Class ↔ Special Background lock. Special 21 only; public pipeline untouched._\n\n`;
md += `## Class-lock map\n\n| Gameplay Class | Locked Background |\n|---|---|\n`;
for (const [cls, bgId] of Object.entries(CLASS_TO_BG)) md += `| ${cls} | ${bgId} |\n`;
md += `\n## Checks\n\n| Check | Result | Detail |\n|---|---|---|\n`;
for (const [n, ok, d] of checks) md += `| ${n} | ${ok ? "PASS ✅" : "FAIL ❌"} | ${d} |\n`;
md += `\n**Overall: ${allPass ? "ALL CHECKS PASSED ✅" : "FAILURES PRESENT ❌"}**\n\n`;
md += `> The Special 21 (Founder #001 + 20 Legendary) are still artwork-pending; once each is assigned a \`gameplayClass\` + \`specialBackground\`, this validator enforces the lock automatically. \`validateSpecialToken()\` is exported for the future Special-21 generator.\n`;
fs.writeFileSync(path.join(REPORTS, "special-background-validation.md"), md);

console.log(md);
if (!allPass) process.exitCode = 1;
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) runCli();
