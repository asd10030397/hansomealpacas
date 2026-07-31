/**
 * Phase 11E — live Hook Position Index validation + report artifacts.
 * Discovery only — no valuation / lock claims / alias promotion.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, http } from "viem";
import { DEFAULT_RPC_URL, robinhoodChain } from "../lib/chain";
import {
  GME_TOKEN,
  HANSOME_TOKEN,
  OKC_TOKEN,
  createHookPosChainPort,
  findHookPoolFixtureByToken,
  isHansomeClassAToken,
  resolveHookPositionIndex,
  bootstrapHookPositionIndex,
  buildHookPositionIndexSummary,
  clearHookPosProductionMemoryForTests,
} from "../lib/hansome-score/lp/hook-position-index";

const ROOT = resolve(process.cwd());
const DATA = resolve(ROOT, "reports/data");

async function main() {
  mkdirSync(DATA, { recursive: true });
  clearHookPosProductionMemoryForTests();

  const client = createPublicClient({
    chain: robinhoodChain,
    transport: http(DEFAULT_RPC_URL, { timeout: 30_000 }),
  });
  const port = createHookPosChainPort(client);

  const gmeFixture = findHookPoolFixtureByToken(GME_TOKEN)!;
  const okcFixture = findHookPoolFixtureByToken(OKC_TOKEN)!;

  console.log("[phase11e] GME bootstrap…");
  const gmeState = await bootstrapHookPositionIndex({
    port,
    opts: {
      chainId: 4663,
      poolId: gmeFixture.poolId,
      hookAddress: gmeFixture.hookAddress,
      positionManager: gmeFixture.positionManager,
      poolManager: gmeFixture.poolManager,
      createTx: gmeFixture.createTx,
      createBlock: gmeFixture.createBlock,
      confirmationDepth: 64,
      interactiveBudgetMs: 45_000,
      tipCatchUpBlocks: 20_000,
      fixture: gmeFixture,
      indexForeign: false,
    },
  });
  const gmeSummary = buildHookPositionIndexSummary(gmeState);

  console.log("[phase11e] OKC bootstrap…");
  const okcState = await bootstrapHookPositionIndex({
    port,
    opts: {
      chainId: 4663,
      poolId: okcFixture.poolId,
      hookAddress: okcFixture.hookAddress,
      positionManager: okcFixture.positionManager,
      poolManager: okcFixture.poolManager,
      createTx: okcFixture.createTx,
      createBlock: okcFixture.createBlock,
      confirmationDepth: 64,
      interactiveBudgetMs: 20_000,
      tipCatchUpBlocks: 10_000,
      fixture: okcFixture,
      indexForeign: false,
    },
  });
  const okcSummary = buildHookPositionIndexSummary(okcState);

  console.log("[phase11e] HANSOME Class A skip check…");
  const hansome = await resolveHookPositionIndex({
    tokenAddress: HANSOME_TOKEN,
    ownershipClass: "posm_nft",
    client,
    disableBackground: true,
  });

  const gmeArtifact = {
    token: GME_TOKEN,
    poolId: gmeFixture.poolId,
    createTx: gmeFixture.createTx,
    summary: gmeSummary,
    positions: gmeState.positions.map((p) => ({
      owner: p.owner,
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      salt: p.salt,
      classification: p.classification,
      netLiquidityDelta: p.netLiquidityDelta,
      liveLiquidity: p.liveLiquidity,
      stateViewValidated: p.stateViewValidated,
      active: p.active,
      source: p.source,
    })),
    terminalState: gmeState.terminalState,
    incompleteReasons: gmeState.incompleteReasons,
    metrics: gmeState.metrics,
  };

  const okcArtifact = {
    token: OKC_TOKEN,
    poolId: okcFixture.poolId,
    summary: okcSummary,
    positions: okcState.positions.map((p) => ({
      owner: p.owner,
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      salt: p.salt,
      classification: p.classification,
      liveLiquidity: p.liveLiquidity,
      stateViewValidated: p.stateViewValidated,
      source: p.source,
    })),
    terminalState: okcState.terminalState,
    incompleteReasons: okcState.incompleteReasons,
    metrics: okcState.metrics,
  };

  writeFileSync(
    resolve(DATA, "phase11e_gme_index.json"),
    JSON.stringify(gmeArtifact, null, 2),
  );
  writeFileSync(
    resolve(DATA, "phase11e_okc_index.json"),
    JSON.stringify(okcArtifact, null, 2),
  );

  const gmeOk =
    gmeSummary.hookOwnedCount === 8 &&
    gmeState.positions
      .filter((p) => p.classification === "hook_owned")
      .every((p) => p.stateViewValidated === true);

  const verdict =
    gmeOk &&
    (gmeState.terminalState === "SUCCESS_COMPLETE" ||
      gmeState.terminalState === "SUCCESS_PARTIAL") &&
    (okcState.terminalState === "SUCCESS_COMPLETE" ||
      okcState.terminalState === "SUCCESS_PARTIAL") &&
    hansome.skipped &&
    isHansomeClassAToken(HANSOME_TOKEN)
      ? okcState.hookDiscoveryComplete && gmeState.hookDiscoveryComplete
        ? "PASS_NOT_DEPLOYED"
        : "PARTIAL_PASS_NOT_DEPLOYED"
      : "FAIL";

  const summary = {
    phase: "PHASE11E_HOOK_POSITION_INDEX",
    probedAt: new Date().toISOString(),
    chainId: 4663,
    verdict,
    productionTipExpected: "dpl_995JvbHVDTsv4mSP77rJqeas8GEA",
    GME: {
      hookOwnedCount: gmeSummary.hookOwnedCount,
      hookDiscoveryComplete: gmeSummary.hookDiscoveryComplete,
      foreignDiscoveryComplete: gmeSummary.foreignDiscoveryComplete,
      terminalState: gmeState.terminalState,
      discoveryMethod: gmeState.discoveryMethod,
      incompleteReasons: gmeState.incompleteReasons,
      salts:
        gmeState.positions
          .filter((p) => p.classification === "hook_owned")
          .map((p) => Number(BigInt(p.salt)))
          .sort((a, b) => a - b),
    },
    OKC: {
      hookOwnedCount: okcSummary.hookOwnedCount,
      hookDiscoveryComplete: okcSummary.hookDiscoveryComplete,
      foreignDiscoveryComplete: okcSummary.foreignDiscoveryComplete,
      terminalState: okcState.terminalState,
      discoveryMethod: okcState.discoveryMethod,
      incompleteReasons: okcState.incompleteReasons,
    },
    HANSOME: {
      ownershipClassExpected: "posm_nft",
      hookIndexSkipped: hansome.skipped,
      skipReason: hansome.skipReason,
    },
    metrics: {
      gmeWallMs: gmeState.metrics?.wallMs ?? null,
      okcWallMs: okcState.metrics?.wallMs ?? null,
      gmeRpcCalls: gmeState.metrics?.rpcCalls ?? null,
      okcRpcCalls: okcState.metrics?.rpcCalls ?? null,
    },
  };

  writeFileSync(
    resolve(DATA, "phase11e_hook_position_index_summary.json"),
    JSON.stringify(summary, null, 2),
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
