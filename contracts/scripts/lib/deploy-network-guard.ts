/**
 * Shared Hardhat deploy guards for Testnet / Mainnet ceremonies.
 * Never logs private keys — only addresses, chainIds, and plan fields.
 *
 * Mainnet Genesis / game ceremonies: Robinhood Chain Mainnet ONLY
 *   chainId = 4663
 *   RPC    = https://rpc.mainnet.chain.robinhood.com
 * Never Robinhood Testnet (46630).
 */

import { network as hardhatNetwork } from "hardhat";
import {
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_MAINNET_RPC_HOST,
  ROBINHOOD_MAINNET_RPC_URL,
  ROBINHOOD_TESTNET_CHAIN_ID,
  resolveRobinhoodMainnetRpcUrl,
} from "./robinhood-mainnet-rpc";

export {
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_MAINNET_RPC_HOST,
  ROBINHOOD_MAINNET_RPC_URL,
  ROBINHOOD_TESTNET_CHAIN_ID,
};

/** Hardhat network names allowed for deploy scripts. */
export const KNOWN_DEPLOY_NETWORKS = [
  "hardhat",
  "robinhoodTestnet",
  "robinhood",
  "mainnet", // alias of Robinhood Mainnet (chainId 4663)
] as const;

export type KnownDeployNetwork = (typeof KNOWN_DEPLOY_NETWORKS)[number];

export type DeployNetworkContext = {
  networkName: string;
  chainId: number;
};

export function isDryRun(): boolean {
  const v = process.env.DRY_RUN?.trim();
  return v === "1" || v === "true" || v === "yes";
}

export function isMainnetNetwork(ctx: DeployNetworkContext): boolean {
  return (
    ctx.chainId === ROBINHOOD_MAINNET_CHAIN_ID ||
    ctx.networkName === "robinhood" ||
    ctx.networkName === "mainnet" ||
    ctx.networkName.toLowerCase().includes("mainnet")
  );
}

export function isTestnetNetwork(ctx: DeployNetworkContext): boolean {
  return (
    ctx.chainId === ROBINHOOD_TESTNET_CHAIN_ID ||
    ctx.networkName === "robinhoodTestnet"
  );
}

/**
 * Canonical stem for deployments/*.json on Mainnet.
 * Both `--network mainnet` and `--network robinhood` write robinhood-*.json
 * so Vercel cutover docs stay stable.
 */
export function deploymentFileStem(ctx: DeployNetworkContext): string {
  if (isMainnetNetwork(ctx)) return "robinhood";
  return ctx.networkName;
}

/** Refuse any Hardhat network name not in the allow-list. */
export function assertKnownNetwork(
  networkName: string,
): asserts networkName is KnownDeployNetwork {
  if (!(KNOWN_DEPLOY_NETWORKS as readonly string[]).includes(networkName)) {
    throw new Error(
      `REFUSED: unknown Hardhat network "${networkName}". ` +
        `Allowed: ${KNOWN_DEPLOY_NETWORKS.join(", ")}. ` +
        `Pass an explicit --network flag (Mainnet: --network mainnet or --network robinhood).`,
    );
  }
}

/**
 * Verify provider chainId matches the Hardhat network definition.
 * Prevents Mainnet UI/scripts talking to the wrong RPC.
 */
export function assertChainIdMatchesNetwork(ctx: DeployNetworkContext): void {
  assertKnownNetwork(ctx.networkName);

  if (ctx.networkName === "hardhat") {
    // Local in-memory / forked chainId varies; do not enforce Robinhood IDs.
    return;
  }
  if (
    (ctx.networkName === "robinhood" || ctx.networkName === "mainnet") &&
    ctx.chainId !== ROBINHOOD_MAINNET_CHAIN_ID
  ) {
    throw new Error(
      `REFUSED: network=${ctx.networkName} expects chainId ${ROBINHOOD_MAINNET_CHAIN_ID}, got ${ctx.chainId}. ` +
        `Check RH_RPC_URL. Testnet chainId ${ROBINHOOD_TESTNET_CHAIN_ID} is never allowed here.`,
    );
  }
  if (
    ctx.networkName === "robinhoodTestnet" &&
    ctx.chainId !== ROBINHOOD_TESTNET_CHAIN_ID
  ) {
    throw new Error(
      `REFUSED: network=robinhoodTestnet expects chainId ${ROBINHOOD_TESTNET_CHAIN_ID}, got ${ctx.chainId}. Check RH_TESTNET_RPC_URL.`,
    );
  }
}

/** Hard refuse: Mainnet ceremony must never see Testnet chainId 46630. */
export function assertNotTestnetChainId(ctx: DeployNetworkContext): void {
  if (ctx.chainId === ROBINHOOD_TESTNET_CHAIN_ID) {
    throw new Error(
      `REFUSED: chainId ${ROBINHOOD_TESTNET_CHAIN_ID} (Robinhood Testnet) is not allowed for this Mainnet ceremony. ` +
        `Use --network mainnet (or robinhood) with chainId ${ROBINHOOD_MAINNET_CHAIN_ID}.`,
    );
  }
}

/**
 * Abort if Hardhat network config RPC is Testnet or not Robinhood Mainnet.
 * Reads `network.config.url` from the active Hardhat network.
 */
export function assertRobinhoodMainnetRpc(): void {
  const cfg = hardhatNetwork.config as { url?: string; chainId?: number };
  const url = (cfg.url ?? "").trim();
  if (!url) {
    throw new Error(
      `REFUSED: Mainnet ceremony requires an RPC URL. ` +
        `Expected ${ROBINHOOD_MAINNET_RPC_URL} (set RH_RPC_URL or use hardhat --network mainnet).`,
    );
  }
  // Same rules as hardhat.config RH_RPC_URL resolution.
  resolveRobinhoodMainnetRpcUrl(url);
  if (cfg.chainId != null && cfg.chainId !== ROBINHOOD_MAINNET_CHAIN_ID) {
    throw new Error(
      `REFUSED: Hardhat network.config.chainId=${cfg.chainId}, expected ${ROBINHOOD_MAINNET_CHAIN_ID}.`,
    );
  }
}

/**
 * Mainnet deploy scripts must use an explicit Mainnet Hardhat network.
 * Prefer `--network mainnet`; `--network robinhood` remains accepted.
 * Aborts on chainId ≠ 4663, chainId 46630, or non-Mainnet RPC.
 */
export function assertExplicitMainnetNetwork(ctx: DeployNetworkContext): void {
  if (ctx.networkName !== "mainnet" && ctx.networkName !== "robinhood") {
    throw new Error(
      `REFUSED: Mainnet deploy requires explicit --network mainnet (preferred) or --network robinhood. ` +
        `Got network=${ctx.networkName} chainId=${ctx.chainId}. ` +
        `Never use --network robinhoodTestnet (46630).`,
    );
  }
  assertNotTestnetChainId(ctx);
  if (ctx.chainId !== ROBINHOOD_MAINNET_CHAIN_ID) {
    throw new Error(
      `REFUSED: Mainnet deploy requires provider chainId ${ROBINHOOD_MAINNET_CHAIN_ID}, got ${ctx.chainId}. ` +
        `Robinhood Testnet ${ROBINHOOD_TESTNET_CHAIN_ID} is forbidden. Check RH_RPC_URL → ${ROBINHOOD_MAINNET_RPC_URL}.`,
    );
  }
  assertRobinhoodMainnetRpc();
}

/**
 * Testnet-oriented scripts (fund tHANSOME, redeploy-only, etc.).
 * Mainnet requires an explicit opt-in ceremony.
 */
export function assertTestnetOnlyScript(
  ctx: DeployNetworkContext,
  scriptName: string,
): void {
  assertChainIdMatchesNetwork(ctx);
  if (isMainnetNetwork(ctx)) {
    throw new Error(
      `REFUSED: ${scriptName} is Testnet-oriented. ` +
        `Refusing network=${ctx.networkName} chainId=${ctx.chainId}. ` +
        `Use scripts/dry-run-mainnet-deploy-plan.ts and a Mainnet-approved deploy path ` +
        `with ALLOW_MAINNET_DEPLOY=1 + CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND.`,
    );
  }
}

/**
 * Mainnet write scripts must set both flags. DRY_RUN never requires confirm.
 */
export function assertMainnetDeployAllowed(
  ctx: DeployNetworkContext,
  scriptName: string,
): void {
  assertChainIdMatchesNetwork(ctx);
  assertExplicitMainnetNetwork(ctx);
  if (!isMainnetNetwork(ctx)) {
    throw new Error(
      `REFUSED: ${scriptName} expected Mainnet (mainnet|robinhood / ${ROBINHOOD_MAINNET_CHAIN_ID}), ` +
        `got network=${ctx.networkName} chainId=${ctx.chainId}.`,
    );
  }
  if (isDryRun()) {
    console.log(`[${scriptName}] DRY_RUN=1 — no transactions will be sent.`);
    return;
  }
  if (process.env.ALLOW_MAINNET_DEPLOY?.trim() !== "1") {
    throw new Error(
      `REFUSED: ${scriptName} on Mainnet requires ALLOW_MAINNET_DEPLOY=1 (and prefer DRY_RUN=1 first).`,
    );
  }
  if (process.env.CONFIRM_MAINNET_DEPLOY?.trim() !== "I_UNDERSTAND") {
    throw new Error(
      `REFUSED: ${scriptName} on Mainnet requires CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND when not in DRY_RUN.`,
    );
  }
}

export function logDeployBanner(
  scriptName: string,
  ctx: DeployNetworkContext,
  extras: Record<string, string | number | boolean | null | undefined> = {},
): void {
  const cfg = hardhatNetwork.config as { url?: string };
  console.log("============================================================");
  console.log(`SCRIPT:   ${scriptName}`);
  console.log(`NETWORK:  ${ctx.networkName}`);
  console.log(`CHAIN_ID: ${ctx.chainId}`);
  if (isMainnetNetwork(ctx)) {
    console.log(`RPC:      ${cfg.url || "(unset)"}`);
    console.log(`EXPECT:   chainId=${ROBINHOOD_MAINNET_CHAIN_ID} rpc=${ROBINHOOD_MAINNET_RPC_URL}`);
    console.log(`FORBID:   chainId=${ROBINHOOD_TESTNET_CHAIN_ID} (Robinhood Testnet)`);
  }
  console.log(`DRY_RUN:  ${isDryRun() ? "YES" : "NO"}`);
  console.log(`JSON_STEM:${deploymentFileStem(ctx)}`);
  for (const [k, v] of Object.entries(extras)) {
    if (v === undefined) continue;
    console.log(`${k}: ${v}`);
  }
  console.log("============================================================");
}

/**
 * Print chainId + constructor/target plan immediately before the first live tx.
 * Call only after assertMainnetDeployAllowed (live path).
 */
export function logLiveMainnetPreflight(
  scriptName: string,
  ctx: DeployNetworkContext,
  targets: Record<string, string | number | boolean | null | undefined>,
): void {
  console.log("");
  console.log("!!!!!!!!!! LIVE MAINNET PREFLIGHT !!!!!!!!!!");
  console.log(`script:              ${scriptName}`);
  console.log(`hardhatNetwork:      ${ctx.networkName}`);
  console.log(`providerChainId:     ${ctx.chainId}`);
  console.log(
    `expectedChainId:     ${ROBINHOOD_MAINNET_CHAIN_ID} (Testnet 46630 FORBIDDEN)`,
  );
  console.log(`expectedRpc:         ${ROBINHOOD_MAINNET_RPC_URL}`);
  const cfg = hardhatNetwork.config as { url?: string };
  console.log(`configuredRpc:       ${cfg.url || "(unset)"}`);
  console.log(`ALLOW_MAINNET_DEPLOY:${process.env.ALLOW_MAINNET_DEPLOY?.trim()}`);
  console.log(
    `CONFIRM_MAINNET_DEPLOY:${process.env.CONFIRM_MAINNET_DEPLOY?.trim()}`,
  );
  console.log("--- constructor / target addresses ---");
  for (const [k, v] of Object.entries(targets)) {
    if (v === undefined) continue;
    console.log(`  ${k}: ${v}`);
  }
  console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.log("");
}

export function explorerBase(ctx: DeployNetworkContext): string {
  if (isMainnetNetwork(ctx)) return "https://robinhoodchain.blockscout.com";
  if (isTestnetNetwork(ctx)) return "https://explorer.testnet.chain.robinhood.com";
  return "";
}
