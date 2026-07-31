/**
 * Week 2A multi-token live batch scan + regression snapshot.
 * Usage: npx tsx scripts/hansome-score-week2a-batch.ts
 *
 * Writes:
 *   reports/hansome-score-week2a-batch.json
 * Does not start Explore / Week 2B.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { HANSOME_TOKEN, scanToken } from "@/lib/hansome-score";

type FixtureToken = {
  address: string;
  symbolHint?: string;
  note?: string;
  required?: boolean;
  characteristics?: string[];
};

async function main() {
  const fixturePath = resolve(
    process.cwd(),
    "lib/hansome-score/__fixtures__/regression-set.json",
  );
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    version: string;
    tokens: FixtureToken[];
  };

  const tokens = fixture.tokens;
  if (!tokens.some((t) => t.address.toLowerCase() === HANSOME_TOKEN.toLowerCase())) {
    throw new Error("Regression fixture missing required HANSOME token");
  }

  const results: unknown[] = [];
  const summaries: Array<Record<string, unknown>> = [];

  console.log(`Week 2A batch — ${tokens.length} tokens (spec ${fixture.version})`);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const label = t.symbolHint ?? t.address.slice(0, 10);
    process.stdout.write(`[${i + 1}/${tokens.length}] ${label} … `);
    const started = Date.now();
    try {
      const scan = await scanToken(t.address);
      const ms = Date.now() - started;
      results.push(scan);
      const row = {
        address: scan.overview.address,
        symbol: scan.overview.symbol,
        note: t.note ?? null,
        characteristics: t.characteristics ?? [],
        score: scan.score.score,
        activity: scan.activity.level,
        confidence: scan.confidence.percent,
        incompleteCategories: scan.score.incompleteCategories,
        categoryTotals: scan.score.categoryTotals,
        deductions: scan.score.deductions.map((d) => `${d.code}(-${d.points})`),
        lockAggregate: scan.overview.lpIntelligence.aggregateLockState,
        positions: scan.overview.lpIntelligence.positions.map((p) => ({
          id: p.positionNftId,
          owner: p.owner,
          lockState: p.lockState,
          removableByEoa: p.removableByEoa,
          inRange: p.inRange,
          liquidity: p.liquidity,
        })),
        discoverySources: scan.overview.lpIntelligence.discoverySources ?? [],
        creator: {
          status: scan.overview.creatorBehaviour.status,
          available: scan.overview.creatorBehaviour.available,
          dumpDetected: scan.overview.creatorBehaviour.dumpDetected,
          transferThenSellDetected: scan.overview.creatorBehaviour.transferThenSellDetected,
          sellPct: scan.overview.creatorBehaviour.creatorSellPctOfSupply,
          outbound: scan.overview.creatorBehaviour.outboundTransferCount,
          detail: scan.overview.creatorBehaviour.detail,
        },
        contractRisk: {
          status: scan.overview.contractRisk.status,
          mintable: scan.overview.contractRisk.mintable,
          honeypot: scan.overview.contractRisk.honeypot,
          hasOwnerAdmin: scan.overview.contractRisk.hasOwnerAdmin,
          detail: scan.overview.contractRisk.detail,
        },
        elapsedMs: ms,
        error: null as string | null,
      };
      summaries.push(row);
      console.log(
        `score=${row.score} lock=${row.lockAggregate} creator=${row.creator.status} (${ms}ms)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summaries.push({
        address: t.address,
        symbol: t.symbolHint ?? null,
        note: t.note ?? null,
        error: msg,
        elapsedMs: Date.now() - started,
      });
      console.log(`ERROR ${msg}`);
      if (t.required) throw err;
    }
  }

  const outDir = resolve(process.cwd(), "reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "hansome-score-week2a-batch.json");
  const payload = {
    version: fixture.version,
    scannedAt: new Date().toISOString(),
    tokenCount: summaries.length,
    summaries,
    fullScans: results,
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\nWrote ${outPath}`);

  const hansome = summaries.find(
    (s) =>
      typeof s.address === "string" &&
      s.address.toLowerCase() === HANSOME_TOKEN.toLowerCase(),
  );
  if (hansome) {
    console.log("\n=== HANSOME Week 2A ===");
    console.log(JSON.stringify(hansome, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
