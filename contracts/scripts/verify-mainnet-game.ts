/**
 * Read-only Mainnet Game suite verification against deployments/robinhood-game.json.
 * Never sends transactions.
 *
 * Env (optional overrides):
 *   GAME_ADDRESS / GENESIS_NFT_ADDRESS — else from robinhood-game.json
 *   MAINNET_OWNER — expected Ownable owner (warn if unset)
 *   RANDOMNESS_PROVIDER — expected provider (else JSON randomnessProvider)
 *
 * Usage:
 *   npx hardhat run scripts/verify-mainnet-game.ts --network mainnet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import {
  assertChainIdMatchesNetwork,
  assertExplicitMainnetNetwork,
  assertKnownNetwork,
  deploymentFileStem,
  explorerBase,
  logDeployBanner,
  ROBINHOOD_MAINNET_CHAIN_ID,
} from "./lib/deploy-network-guard";
import {
  PROD_COMMIT_DURATION_SEC,
  PROD_DAY_LENGTH_SEC,
  PROD_REVEAL_DURATION_SEC,
} from "./lib/game-timing";
import {
  assertCanonicalMainnetHansome,
  assertNotTestnetContractAddress,
  CANONICAL_MAINNET_HANSOME,
  type GameDeploymentJson,
  isForbiddenTestnetContractAddress,
} from "./lib/mainnet-game-guards";

type Check = {
  id: string;
  ok: boolean;
  severity: "pass" | "warn" | "fail";
  detail: string;
};

async function main() {
  process.env.DRY_RUN = "1";

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const ctx = { networkName: network.name, chainId };
  assertKnownNetwork(ctx.networkName);
  assertChainIdMatchesNetwork(ctx);
  assertExplicitMainnetNetwork(ctx);

  const fileStem = deploymentFileStem(ctx);
  const gamePath = join(__dirname, "..", "deployments", `${fileStem}-game.json`);
  if (!existsSync(gamePath)) {
    throw new Error(
      `REFUSED: missing ${fileStem}-game.json — deploy-game Mainnet ceremony first.`,
    );
  }
  const json = JSON.parse(readFileSync(gamePath, "utf8")) as GameDeploymentJson;

  const gameAddr = ethers.getAddress(
    process.env.GAME_ADDRESS?.trim() || json.address,
  );
  const expectedGenesis = ethers.getAddress(
    process.env.GENESIS_NFT_ADDRESS?.trim() || json.genesis,
  );

  logDeployBanner("verify-mainnet-game.ts", ctx, {
    GAME: gameAddr,
    JSON: gamePath,
    EXPLORER: explorerBase(ctx),
    NOTE: "READ-ONLY — no transactions",
  });

  const checks: Check[] = [];
  const push = (c: Check) => {
    checks.push(c);
    const mark = c.ok ? "PASS" : c.severity.toUpperCase();
    console.log(`[${mark}] ${c.id}: ${c.detail}`);
  };

  push({
    id: "chainId",
    ok: chainId === ROBINHOOD_MAINNET_CHAIN_ID && json.chainId === chainId,
    severity:
      chainId === ROBINHOOD_MAINNET_CHAIN_ID && json.chainId === chainId
        ? "pass"
        : "fail",
    detail: `provider=${chainId} json.chainId=${json.chainId} expect=${ROBINHOOD_MAINNET_CHAIN_ID}`,
  });

  const labeled = [
    ["game", gameAddr],
    ["genesis", expectedGenesis],
    ["token", json.token],
    ["treasury", json.treasury],
    ["emission", json.emission],
    ["distributor", json.distributor],
    ["randomness", json.randomness],
    ["sinks", json.sinks],
  ] as const;

  for (const [label, addr] of labeled) {
    const forbidden = isForbiddenTestnetContractAddress(addr);
    push({
      id: `not_testnet_${label}`,
      ok: !forbidden,
      severity: forbidden ? "fail" : "pass",
      detail: forbidden
        ? `${label} ${addr} is a known Testnet address`
        : `${label}=${addr}`,
    });
  }

  let tokenCanonicalOk = false;
  try {
    assertCanonicalMainnetHansome(json.token);
    tokenCanonicalOk = true;
  } catch {
    tokenCanonicalOk = false;
  }
  push({
    id: "token_canonical",
    ok: tokenCanonicalOk,
    severity: tokenCanonicalOk ? "pass" : "fail",
    detail: `json.token=${json.token} expect=${CANONICAL_MAINNET_HANSOME}`,
  });

  const game = await ethers.getContractAt("HansomeGame", gameAddr);
  const onGenesis = ethers.getAddress(await game.genesis());
  const onTreasury = ethers.getAddress(await game.treasury());
  const onEmission = ethers.getAddress(await game.emission());
  const onDistributor = ethers.getAddress(await game.distributor());
  const onRandomness = ethers.getAddress(await game.randomness());
  const onDayZero = Number(await game.dayZero());
  const onDayLength = Number(await game.dayLength());
  const onCommit = Number(await game.commitDuration());
  const onReveal = Number(await game.revealDuration());
  const gameOwner = ethers.getAddress(await game.owner());

  const match = (label: string, onChain: string, expected: string) => {
    const ok = onChain === ethers.getAddress(expected);
    push({
      id: `link_${label}`,
      ok,
      severity: ok ? "pass" : "fail",
      detail: ok
        ? `${label}=${onChain}`
        : `${label} on-chain=${onChain} json/expected=${expected}`,
    });
  };

  match("genesis", onGenesis, expectedGenesis);
  match("treasury", onTreasury, json.treasury);
  match("emission", onEmission, json.emission);
  match("distributor", onDistributor, json.distributor);
  match("randomness", onRandomness, json.randomness);

  // Cross-check suite contracts against HansomeGame immutables + JSON.
  assertNotTestnetContractAddress("on-chain genesis", onGenesis);

  const treasury = await ethers.getContractAt("GameTreasury", onTreasury);
  const treasuryToken = ethers.getAddress(await treasury.token());
  const treasuryGame = ethers.getAddress(await treasury.game());
  const treasuryDist = ethers.getAddress(await treasury.distributor());
  const treasurySinks = ethers.getAddress(await treasury.sinkRegistry());
  const treasuryOwner = ethers.getAddress(await treasury.owner());

  push({
    id: "treasury_token",
    ok: treasuryToken === ethers.getAddress(CANONICAL_MAINNET_HANSOME),
    severity:
      treasuryToken === ethers.getAddress(CANONICAL_MAINNET_HANSOME)
        ? "pass"
        : "fail",
    detail: `treasury.token=${treasuryToken}`,
  });
  match("treasury.game", treasuryGame, gameAddr);
  match("treasury.distributor", treasuryDist, json.distributor);
  match("treasury.sinkRegistry", treasurySinks, json.sinks);

  const distributor = await ethers.getContractAt(
    "RewardDistributor",
    onDistributor,
  );
  const distNft = ethers.getAddress(await distributor.nft());
  const distTreasury = ethers.getAddress(await distributor.treasury());
  const distGame = ethers.getAddress(await distributor.game());
  const distOwner = ethers.getAddress(await distributor.owner());
  match("distributor.nft", distNft, onGenesis);
  match("distributor.treasury", distTreasury, onTreasury);
  match("distributor.game", distGame, gameAddr);

  const randomness = await ethers.getContractAt("GameRandomness", onRandomness);
  const providerOnChain = ethers.getAddress(
    await randomness.randomnessProvider(),
  );
  const randOwner = ethers.getAddress(await randomness.owner());
  const expectedProvider = ethers.getAddress(
    process.env.RANDOMNESS_PROVIDER?.trim() ||
      json.randomnessProvider ||
      json.deployer ||
      providerOnChain,
  );
  push({
    id: "randomness_provider",
    ok: providerOnChain === expectedProvider,
    severity: providerOnChain === expectedProvider ? "pass" : "fail",
    detail: `provider=${providerOnChain} expected=${expectedProvider}`,
  });
  if (json.randomnessProvider) {
    push({
      id: "randomness_provider_json",
      ok: providerOnChain === ethers.getAddress(json.randomnessProvider),
      severity:
        providerOnChain === ethers.getAddress(json.randomnessProvider)
          ? "pass"
          : "fail",
      detail: `on-chain=${providerOnChain} json.randomnessProvider=${json.randomnessProvider}`,
    });
  } else {
    push({
      id: "randomness_provider_json",
      ok: false,
      severity: "warn",
      detail: "json.randomnessProvider missing — re-deploy with newer deploy-game.ts",
    });
  }

  const sinks = await ethers.getContractAt("SinkRegistry", json.sinks);
  const sinksToken = ethers.getAddress(await sinks.token());
  const sinksTreasury = ethers.getAddress(await sinks.treasury());
  const sinksOwner = ethers.getAddress(await sinks.owner());
  match("sinks.token", sinksToken, CANONICAL_MAINNET_HANSOME);
  match("sinks.treasury", sinksTreasury, onTreasury);

  const timingOk =
    onDayLength === PROD_DAY_LENGTH_SEC &&
    onCommit === PROD_COMMIT_DURATION_SEC &&
    onReveal === PROD_REVEAL_DURATION_SEC &&
    onDayZero === Number(json.dayZero) &&
    onDayLength === Number(json.dayLengthSec) &&
    onCommit === Number(json.commitDurationSec) &&
    onReveal === Number(json.revealDurationSec);

  push({
    id: "timing",
    ok: timingOk,
    severity: timingOk ? "pass" : "fail",
    detail: `dayZero=${onDayZero} day=${onDayLength} commit=${onCommit} reveal=${onReveal} (GDS ${PROD_DAY_LENGTH_SEC}/${PROD_COMMIT_DURATION_SEC}/${PROD_REVEAL_DURATION_SEC})`,
  });

  const plannedOwner = process.env.MAINNET_OWNER?.trim()
    ? ethers.getAddress(process.env.MAINNET_OWNER.trim())
    : null;
  const owners = {
    HansomeGame: gameOwner,
    GameTreasury: treasuryOwner,
    RewardDistributor: distOwner,
    GameRandomness: randOwner,
    SinkRegistry: sinksOwner,
  };
  for (const [role, owner] of Object.entries(owners)) {
    if (plannedOwner) {
      push({
        id: `owner_${role}`,
        ok: owner === plannedOwner,
        severity: owner === plannedOwner ? "pass" : "warn",
        detail:
          owner === plannedOwner
            ? `${role} owner=${owner} (= MAINNET_OWNER)`
            : `${role} owner=${owner} MAINNET_OWNER=${plannedOwner} (transfer pending?)`,
      });
    } else {
      push({
        id: `owner_${role}`,
        ok: true,
        severity: "warn",
        detail: `${role} owner=${owner} (MAINNET_OWNER unset — not compared)`,
      });
    }
  }

  const treasuryBal = await (
    await ethers.getContractAt("HansomeAlpacas", treasuryToken)
  ).balanceOf(onTreasury);
  push({
    id: "treasury_funding",
    ok: treasuryBal > 0n,
    severity: treasuryBal > 0n ? "pass" : "warn",
    detail: `GameTreasury $HANSOME balance=${ethers.formatEther(treasuryBal)} json.treasuryFundedWei=${json.treasuryFundedWei ?? "(unset)"}`,
  });

  const fails = checks.filter((c) => !c.ok && c.severity === "fail");
  const warns = checks.filter((c) => !c.ok && c.severity === "warn");
  const ok = fails.length === 0;

  const report = {
    mode: "VERIFY_READONLY",
    network: ctx.networkName,
    chainId: ctx.chainId,
    game: gameAddr,
    jsonPath: gamePath,
    addresses: {
      genesis: onGenesis,
      token: treasuryToken,
      treasury: onTreasury,
      emission: onEmission,
      distributor: onDistributor,
      randomness: onRandomness,
      sinks: json.sinks,
      randomnessProvider: providerOnChain,
    },
    timing: {
      dayZero: onDayZero,
      dayLengthSec: onDayLength,
      commitDurationSec: onCommit,
      revealDurationSec: onReveal,
    },
    ownership: owners,
    checks,
    ok,
    failCount: fails.length,
    warnCount: warns.length,
    nextStep: ok
      ? "DRY_RUN=1 MAINNET_OWNER=0x… npx hardhat run scripts/transfer-mainnet-ownership.ts --network mainnet"
      : "Fix mismatches before ownership transfer / Vercel cutover",
    generatedAt: new Date().toISOString(),
  };

  const outDir = join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${fileStem}-game-verify.json`);
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("\nWrote", outPath);

  if (!ok) {
    console.error(`\nVERIFICATION FAILED — ${fails.length} blocker(s).`);
    process.exitCode = 2;
  } else {
    console.log("\nVERIFICATION OK — on-chain suite matches robinhood-game.json");
    if (warns.length > 0) {
      console.log(`Warnings: ${warns.length} (review ownership / funding)`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
