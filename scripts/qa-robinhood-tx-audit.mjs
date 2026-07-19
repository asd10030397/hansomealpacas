/**
 * Static audit: every game write must go through sendRobinhoodContractWrite.
 *
 * Usage: node scripts/qa-robinhood-tx-audit.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const HOOKS = join(ROOT, "hooks", "game");

const ENTRY_POINTS = [
  {
    tx: "Public Mint",
    hook: "useGenesisMint.ts",
    ui: ["components/mint/MintPanel.tsx"],
    label: "genesis-mint",
    fn: "publicMint",
  },
  {
    tx: "Whitelist Mint",
    hook: "useGenesisMint.ts",
    ui: ["components/mint/MintPanel.tsx"],
    label: "genesis-mint",
    fn: "whitelistMint",
  },
  {
    tx: "Commit Move",
    hook: "useHansomeCommit.ts",
    ui: ["app/game/commit/page.tsx"],
    label: "hansome-commit",
    fn: "commit",
  },
  {
    tx: "Reveal Move",
    hook: "useHansomeReveal.ts",
    ui: ["app/game/reveal/page.tsx"],
    label: "hansome-reveal",
    fn: "reveal",
  },
  {
    tx: "Settlement",
    hook: "useSettlementView.ts",
    ui: ["app/game/settlement/page.tsx"],
    label: "hansome-settle",
    fn: "settleDay",
  },
  {
    tx: "Claim Rewards",
    hook: "useClaimRewards.ts",
    ui: ["app/game/claim/page.tsx"],
    label: "hansome-claim",
    fn: "claimMany",
  },
];

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function listTsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listTsFiles(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function auditHook(src, label, fn) {
  const issues = [];
  if (!src.includes("sendRobinhoodContractWrite")) {
    issues.push("missing sendRobinhoodContractWrite import/call");
  }
  if (!src.includes(`label: "${label}"`) && !src.includes(`label: '${label}'`)) {
    issues.push(`missing label ${label}`);
  }
  if (!src.includes(`"${fn}"`) && !src.includes(`'${fn}'`) && !src.includes(`functionName: "${fn}"`)) {
    // mint uses input.functionName; settle uses settleDay string
    if (fn === "publicMint" || fn === "whitelistMint") {
      if (!src.includes(fn)) issues.push(`missing ${fn} path`);
    } else if (!src.includes(fn)) {
      issues.push(`missing functionName ${fn}`);
    }
  }
  // Direct write with object literal (bypass) — allow only via helper file.
  if (/await\s+writeContractAsync\s*\(\s*\{/.test(src)) {
    issues.push("direct writeContractAsync({...}) bypass");
  }
  if (/\bgasLimit\b/.test(src)) issues.push("gasLimit present in hook");
  return issues;
}

function auditHelper() {
  const src = read("lib/game/robinhoodContractWrite.ts");
  const checks = {
    simulate: src.includes("simulateContract"),
    estimate: src.includes("estimateContractGas"),
    buildFees: src.includes("buildSafeMintFees"),
    assertFee: src.includes("assertSaneMintNetworkFee"),
    getGasPrice: src.includes("getGasPrice"),
    noGasLimitInWrite: /writeContractAsync\(\s*walletRequest\s*\)/.test(src),
    // Final wallet payload must only pin EIP-1559 caps (no gas / gasLimit keys).
    omitsGasLimit: (() => {
      const m = src.match(
        /const walletRequest: RobinhoodWalletRequest = \{([\s\S]*?)\};/,
      );
      if (!m) return false;
      const body = m[1];
      return (
        /maxFeePerGas/.test(body) &&
        /maxPriorityFeePerGas/.test(body) &&
        !/\bgas\s*:/.test(body) &&
        !/\bgasLimit\s*:/.test(body)
      );
    })(),
  };
  return checks;
}

const helper = auditHelper();
const rows = [];

for (const ep of ENTRY_POINTS) {
  const hookSrc = read(join("hooks", "game", ep.hook));
  const issues = auditHook(hookSrc, ep.label, ep.fn);
  const uiOk = ep.ui.every((u) => {
    const s = read(u);
    return (
      s.includes(ep.hook.replace(".ts", "")) ||
      s.includes("useGenesisMint") ||
      s.includes("useHansomeCommit") ||
      s.includes("useHansomeReveal") ||
      s.includes("useSettlementView") ||
      s.includes("useClaimRewards")
    );
  });
  // Desktop/mobile: single shared page/hook (no separate mobile tx path).
  const desktopMobileSame = uiOk && issues.length === 0;

  rows.push({
    transaction: ep.tx,
    sharedHelper: issues.length === 0 && helper.simulate,
    simulation: helper.simulate && issues.length === 0,
    gasEstimate: helper.estimate && issues.length === 0,
    metaMaskFee: helper.buildFees && helper.assertFee && helper.omitsGasLimit ? "Normal*" : "FAIL",
    desktop: desktopMobileSame,
    mobile: desktopMobileSame,
    pass: issues.length === 0 && Object.values(helper).every(Boolean),
    issues,
    hook: ep.hook,
    label: ep.label,
  });
}

// Any other hook still calling writeContractAsync directly?
const bypasses = [];
for (const file of listTsFiles(HOOKS)) {
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");
  const src = readFileSync(file, "utf8");
  if (/await\s+writeContractAsync\s*\(\s*\{/.test(src)) {
    bypasses.push(rel);
  }
}

const pass = rows.every((r) => r.pass) && bypasses.length === 0 && Object.values(helper).every(Boolean);

console.log(
  JSON.stringify(
    {
      helper,
      rows,
      bypasses,
      note:
        "MetaMask Fee Normal* = code pins maxFeePerGas/maxPriorityFeePerGas from eth_gasPrice; MetaMask feeHistory fallback is not used. Live wallet confirmation still recommended after deploy.",
      pass,
    },
    null,
    2,
  ),
);

if (!pass) process.exitCode = 1;
