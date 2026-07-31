/**
 * Phase 11F/G/H — live Hook intelligence validation + report artifacts.
 * Candidate research driver — does not promote Production aliases.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, http } from "viem";
import { DEFAULT_RPC_URL, robinhoodChain } from "../lib/chain";
import { resolveHookIntelligence } from "../lib/hansome-score/lp/hook-intelligence/resolve";
import {
  GME_TOKEN,
  HANSOME_TOKEN,
  OKC_TOKEN,
  clearHookPosProductionMemoryForTests,
  findHookPoolFixtureByToken,
} from "../lib/hansome-score/lp/hook-position-index";
import { RH_QUOTE_TOKENS } from "../lib/hansome-score/lp/deployments";

const ROOT = resolve(process.cwd());
const DATA = resolve(ROOT, "reports/data");

function jsonSafe(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      o[k] = jsonSafe(val);
    }
    return o;
  }
  return v;
}

async function main() {
  mkdirSync(DATA, { recursive: true });
  clearHookPosProductionMemoryForTests();

  const client = createPublicClient({
    chain: robinhoodChain,
    transport: http(DEFAULT_RPC_URL, { timeout: 45_000 }),
  });

  console.log("[phase11fgh] GME resolve…");
  const gme = await resolveHookIntelligence({
    tokenAddress: GME_TOKEN,
    ownershipClass: "hook_native",
    tokenDecimals: 18,
    client,
    interactiveBudgetMs: 45_000,
    disableBackground: true,
    priceBook: {
      tokenAddress: GME_TOKEN,
      tokenDecimals: 18,
      tokenPriceUsd: null,
      ethUsd: 3000,
    },
  });

  console.log("[phase11fgh] OKC resolve…");
  const okc = await resolveHookIntelligence({
    tokenAddress: OKC_TOKEN,
    ownershipClass: "hook_native",
    tokenDecimals: 18,
    client,
    interactiveBudgetMs: 25_000,
    disableBackground: true,
    priceBook: {
      tokenAddress: OKC_TOKEN,
      tokenDecimals: 18,
      tokenPriceUsd: null,
      ethUsd: 3000,
    },
  });

  console.log("[phase11fgh] HANSOME Class A skip…");
  const hansome = await resolveHookIntelligence({
    tokenAddress: HANSOME_TOKEN,
    ownershipClass: "posm_nft",
    client,
    disableBackground: true,
  });

  const gmeVal = {
    token: GME_TOKEN,
    poolId: findHookPoolFixtureByToken(GME_TOKEN)?.poolId,
    skipped: gme.skipped,
    index: gme.indexState
      ? {
          terminalState: gme.indexState.terminalState,
          hookOwnedCount: gme.indexState.positions.filter(
            (p) => p.classification === "hook_owned",
          ).length,
          salts: gme.indexState.positions
            .filter((p) => p.classification === "hook_owned")
            .map((p) => p.salt),
          hookDiscoveryComplete: gme.indexState.hookDiscoveryComplete,
          foreignDiscoveryComplete: gme.indexState.foreignDiscoveryComplete,
        }
      : null,
    valuation: gme.valuation
      ? {
          terminalState: gme.valuation.terminalState,
          summary: gme.valuation.summary,
          positions: gme.valuation.positions.map((p) => ({
            owner: p.owner,
            tickLower: p.tickLower,
            tickUpper: p.tickUpper,
            salt: p.salt,
            liquidity: p.liquidity,
            active: p.active,
            amount0Raw: p.amount0Raw,
            amount1Raw: p.amount1Raw,
            amount0: p.amount0,
            amount1: p.amount1,
            totalValueUsd: p.totalValueUsd,
            valuationComplete: p.valuationComplete,
            stateViewValidated: p.stateViewValidated,
          })),
        }
      : null,
    foreign: gme.foreignSeparation,
    lock: gme.lockClassification,
    protocol: gme.protocol
      ? {
          status: gme.protocol.hookState?.statusName,
          initializer: gme.protocol.assetData?.poolInitializer,
          migrator: gme.protocol.assetData?.liquidityMigrator,
          hookPosmNftBalance: gme.protocol.hookPosmNftBalance?.toString(),
          sflExists: gme.protocol.sfl?.exists ?? false,
        }
      : null,
    error: gme.error,
  };

  const okcVal = {
    token: OKC_TOKEN,
    poolId: findHookPoolFixtureByToken(OKC_TOKEN)?.poolId,
    skipped: okc.skipped,
    index: okc.indexState
      ? {
          terminalState: okc.indexState.terminalState,
          hookOwnedCount: okc.indexState.positions.filter(
            (p) => p.classification === "hook_owned",
          ).length,
          hookDiscoveryComplete: okc.indexState.hookDiscoveryComplete,
          foreignDiscoveryComplete: okc.indexState.foreignDiscoveryComplete,
          incompleteReasons: okc.indexState.incompleteReasons,
        }
      : null,
    valuation: okc.valuation?.summary ?? null,
    foreign: okc.foreignSeparation,
    lock: okc.lockClassification,
    protocol: okc.protocol
      ? {
          status: okc.protocol.hookState?.statusName,
          initializer: okc.protocol.assetData?.poolInitializer,
          migrator: okc.protocol.assetData?.liquidityMigrator,
          hookPosmNftBalance: okc.protocol.hookPosmNftBalance?.toString(),
        }
      : null,
    error: okc.error,
  };

  writeFileSync(
    resolve(DATA, "phase11f_gme_valuation.json"),
    JSON.stringify(jsonSafe(gmeVal), null, 2),
  );
  writeFileSync(
    resolve(DATA, "phase11f_okc_valuation.json"),
    JSON.stringify(jsonSafe(okcVal), null, 2),
  );
  writeFileSync(
    resolve(DATA, "phase11g_foreign_lp_summary.json"),
    JSON.stringify(
      jsonSafe({
        gme: gme.foreignSeparation,
        okc: okc.foreignSeparation,
        note: "foreignDiscoveryComplete expected false without exhaustive ML replay",
        weth: RH_QUOTE_TOKENS.WETH,
      }),
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(DATA, "phase11h_hook_lock_classification.json"),
    JSON.stringify(
      jsonSafe({
        gme: gme.lockClassification,
        okc: okc.lockClassification,
        hansomeSkipped: hansome.skipped,
        hansomeSkipReason: hansome.skipReason,
      }),
      null,
      2,
    ),
  );

  const summary = {
    probedAt: new Date().toISOString(),
    chainId: 4663,
    gme: {
      lockState: gme.lockClassification?.state,
      hookOwnedPositions:
        gme.valuation?.summary.hookOwnedPositionCount ?? 0,
      activeHookOwned:
        gme.valuation?.summary.activeHookOwnedPositionCount ?? 0,
      hookValuationComplete:
        gme.valuation?.summary.hookValuationComplete ?? false,
      foreignDiscoveryComplete:
        gme.foreignSeparation?.foreignDiscoveryComplete ?? false,
      poolShareAvailable: gme.lockClassification?.poolShareAvailable ?? false,
      principalValueUsd: gme.lockClassification?.principalValueUsd,
    },
    okc: {
      lockState: okc.lockClassification?.state,
      hookDiscoveryComplete:
        okc.foreignSeparation?.hookDiscoveryComplete ?? false,
      hookValuationComplete:
        okc.foreignSeparation?.hookValuationComplete ?? false,
    },
    hansome: {
      skipped: hansome.skipped,
      skipReason: hansome.skipReason,
    },
    productionTipExpected: "dpl_995JvbHVDTsv4mSP77rJqeas8GEA",
  };
  writeFileSync(
    resolve(DATA, "phase11fgh_candidate_summary.json"),
    JSON.stringify(jsonSafe(summary), null, 2),
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
