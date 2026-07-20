/**
 * Static guard: known superseded addresses must not appear in active runtime/QA paths.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { SUPERSEDED_TESTNET_ADDRESSES } from "@/lib/game/contractAddresses";

const ROOT = join(process.cwd());

/** Active runtime / QA surfaces — historical reports excluded. */
const SCAN_ROOTS = ["lib/game", "hooks/game", "app", "scripts", "components/game"];

const SKIP_DIR = new Set([
  "node_modules",
  ".next",
  "dist",
  "__tests__",
  "reports",
  "docs",
]);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !name.includes(".test.")) {
      out.push(p);
    }
  }
  return out;
}

describe("no superseded addresses in active runtime/QA", () => {
  it("scans lib/hooks/app/scripts for known old game/distributor addresses", () => {
    const files = SCAN_ROOTS.flatMap((r) => walk(join(ROOT, r)));
    const hits: string[] = [];
    for (const file of files) {
      // Allow the canonical list module itself.
      if (file.replace(/\\/g, "/").endsWith("lib/game/contractAddresses.ts")) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      for (const addr of SUPERSEDED_TESTNET_ADDRESSES) {
        if (text.toLowerCase().includes(addr.toLowerCase())) {
          hits.push(`${relative(ROOT, file)} → ${addr}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
