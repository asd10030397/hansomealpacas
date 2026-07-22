/**
 * Mainnet-only: GameRandomness.setRandomnessProvider(newProvider).
 * One tx. No ownership transfer. No other contracts.
 *
 *   ALLOW_MAINNET_DEPLOY=1 CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND LIVE_MAINNET_SEND=1 \
 *     npx hardhat run scripts/ops-mainnet-set-randomness-provider.ts --network mainnet
 */
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";
import {
  assertMainnetDeployAllowed,
  isDryRun,
  logDeployBanner,
} from "./lib/deploy-network-guard";

const RANDOMNESS = "0x134f3CE4006a04C2C5DaD0E654d1C4228dd15791";
const EXPECTED_OWNER = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";
const NEW_PROVIDER = "0x4D68639a5e3ad8fD268f801862D464259656Fd6c";
const EXPLORER = "https://robinhoodchain.blockscout.com";

async function main() {
  if (
    process.env.ALLOW_MAINNET_DEPLOY?.trim() !== "1" ||
    process.env.CONFIRM_MAINNET_DEPLOY?.trim() !== "I_UNDERSTAND"
  ) {
    process.env.DRY_RUN = "1";
  }
  if (process.env.LIVE_MAINNET_SEND?.trim() !== "1") {
    process.env.DRY_RUN = "1";
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const ctx = { networkName: network.name, chainId };
  assertMainnetDeployAllowed(ctx, "ops-mainnet-set-randomness-provider.ts");
  logDeployBanner("ops-mainnet-set-randomness-provider.ts", ctx);

  if (chainId !== 4663) {
    throw new Error(`REFUSED: chainId ${chainId} !== 4663`);
  }

  const target =
    process.env.NEW_RANDOMNESS_PROVIDER?.trim() || NEW_PROVIDER;
  if (ethers.getAddress(target) !== ethers.getAddress(NEW_PROVIDER)) {
    throw new Error(
      `REFUSED: target ${target} !== locked ${NEW_PROVIDER}`,
    );
  }

  const signer = await getDeployerSigner(ethers.provider);
  const signerAddr = await signer.getAddress();
  if (ethers.getAddress(signerAddr) !== ethers.getAddress(EXPECTED_OWNER)) {
    throw new Error(
      `REFUSED: signer ${signerAddr} !== expected owner ${EXPECTED_OWNER}`,
    );
  }

  const rand = await ethers.getContractAt("GameRandomness", RANDOMNESS, signer);
  const owner = await rand.owner();
  if (ethers.getAddress(owner) !== ethers.getAddress(EXPECTED_OWNER)) {
    throw new Error(
      `REFUSED: on-chain owner ${owner} !== ${EXPECTED_OWNER}`,
    );
  }

  const oldProvider = await rand.randomnessProvider();
  console.log(
    JSON.stringify(
      {
        chainId,
        randomness: RANDOMNESS,
        owner,
        oldProvider,
        newProvider: NEW_PROVIDER,
        dryRun: isDryRun(),
      },
      null,
      2,
    ),
  );

  if (ethers.getAddress(oldProvider) === ethers.getAddress(NEW_PROVIDER)) {
    throw new Error("REFUSED: provider already set to target — aborting");
  }

  const gas = await rand.setRandomnessProvider.estimateGas(NEW_PROVIDER);
  console.log("gasEstimate", gas.toString());

  if (isDryRun()) {
    console.log("DRY_RUN — no tx sent");
    return;
  }

  const tx = await rand.setRandomnessProvider(NEW_PROVIDER);
  console.log("tx", tx.hash);
  const rc = await tx.wait();
  if (!rc || rc.status !== 1) throw new Error("tx failed");

  const newProvider = await rand.randomnessProvider();
  const ownerAfter = await rand.owner();

  const pass =
    ethers.getAddress(newProvider) === ethers.getAddress(NEW_PROVIDER) &&
    ethers.getAddress(ownerAfter) === ethers.getAddress(EXPECTED_OWNER);

  console.log(
    JSON.stringify(
      {
        pass,
        hash: tx.hash,
        block: rc.blockNumber,
        gasUsed: rc.gasUsed.toString(),
        gasEstimate: gas.toString(),
        oldProvider,
        newProvider,
        ownerAfter,
        explorer: `${EXPLORER}/tx/${tx.hash}`,
      },
      null,
      2,
    ),
  );

  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
