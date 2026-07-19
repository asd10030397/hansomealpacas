import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, "..", "..", "reports", "testnet", "multi-wallet-qa-report.json");
const mdPath = join(__dirname, "..", "..", "reports", "testnet", "multi-wallet-qa-report.md");
const r = JSON.parse(readFileSync(jsonPath, "utf8"));
const lines = [];
const p = (s = "") => lines.push(s);

p("# Multi-Wallet Testnet QA Report");
p("");
p(`Generated: ${r.at}`);
p(`Network: ${r.network}`);
p(`HansomeGame: \`${r.game}\``);
p(`Day: **${r.day}**`);
p(`Relayer (addresses only): \`${r.relayer}\``);
p("");
p("> Private keys are never stored in this report.");
p("");
p("## 1. Test wallets (addresses only)");
p("");
for (const pl of r.players) p(`- **${pl.name}**: \`${pl.address}\``);
p("");
p("## 2. NFTs tested (ownership)");
p("");
for (const o of r.ownership) {
  p(`### ${o.player} (\`${o.address}\`)`);
  for (const n of o.nfts) p(`- #${n.tokenId} — ${n.label}`);
  p("");
}
p("### Class coverage");
p("");
for (const [cls, ids] of Object.entries(r.classCoverage)) {
  p(`- **${cls}**: ${ids.length ? ids.map((i) => `#${i}`).join(", ") : "—"}`);
}
p("");
p("## 3. Commit results");
p("");
p("| Player | Token | Class | Loc | Vault | Tx |");
p("|--------|------:|-------|----:|:-----:|----|");
for (const c of r.commits) {
  p(
    `| ${c.player} | #${c.tokenId} | ${c.label} | ${c.locationId} | ${c.vaultOk ? "OK" : "FAIL"} | \`${c.commitTx.slice(0, 10)}…\` |`,
  );
}
p("");
p("## 4. Reveal / resolve");
p("");
p("```json");
p(JSON.stringify(r.resolve, null, 2));
p("```");
p("");
p("## 5. Personal battle report isolation");
p("");
p("| Player | Personal token IDs | Leaked from others |");
p("|--------|-------------------:|-------------------:|");
for (const b of r.battlePersonal) {
  p(
    `| ${b.player} | ${b.tokenIds.map((t) => `#${t}`).join(", ") || "—"} | ${b.leakedFromOthers.length ? b.leakedFromOthers.map((t) => `#${t}`).join(", ") : "none"} |`,
  );
}
p("");
p("## 6. Rewards / claim");
p("");
p("| Player | Token | Claimable before | Double claim |");
p("|--------|------:|------------------|--------------|");
for (const c of r.claims) {
  p(`| ${c.player} | #${c.tokenId} | ${c.claimableBefore} | ${c.doubleClaim} |`);
}
p("");
p("## 7. Gas report");
p("");
p("| Role | Wallet | Action | Token | Gas used | Fee (ETH) | Tx |");
p("|------|--------|--------|------:|---------:|----------:|----|");
for (const g of r.gas) {
  p(
    `| ${g.role} | \`${g.wallet.slice(0, 8)}…\` | ${g.action} | ${g.tokenId ?? "—"} | ${g.gasUsed} | ${g.feeEth} | \`${g.txHash.slice(0, 10)}…\` |`,
  );
}
const absurd = r.gas.filter((g) => Number(g.feeEth) > 0.01);
p("");
p(
  absurd.length
    ? `**Fee sanity:** FAIL — ${absurd.length} txs above 0.01 ETH`
    : "**Fee sanity:** PASS — no tx above 0.01 ETH",
);
p("");
p("## 8. Pass / Fail summary");
p("");
p("| Check | Result |");
p("|-------|--------|");
for (const [k, v] of Object.entries(r.results)) p(`| ${k} | ${v} |`);
p("");
p("## 9. Bugs found");
p("");
if (r.bugs.length === 0) p("- None recorded in this run.");
else for (const b of r.bugs) p(`- ${b}`);
p("");
p("## 10. Notes / recommended fixes");
p("");
for (const n of r.notes) p(`- ${n}`);
p("");
p("---");
p("");
p(
  "Skill FX are presentation-layer; this report validates on-chain commit→reveal→settle→claim and wallet isolation.",
);
p("");
writeFileSync(mdPath, lines.join("\n"));
console.log("Wrote", mdPath);
console.log(
  "FAIL count:",
  Object.values(r.results).filter((v) => v === "FAIL").length,
);
