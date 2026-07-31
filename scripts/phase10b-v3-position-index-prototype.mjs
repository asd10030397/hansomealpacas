/**
 * Thin launcher for Phase 10B prototype validation.
 * Prefer: npx tsx scripts/phase10b-v3-position-index-prototype.ts
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const ts = join(dir, "phase10b-v3-position-index-prototype.ts");
const r = spawnSync("npx", ["tsx", ts, ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(r.status ?? 1);
