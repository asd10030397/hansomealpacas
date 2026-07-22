/**
 * Sweep excess ETH from Liquidity + selected buyers → funding address.
 * Leaves BUYER_ETH_GAS_CUSHION / LIQ_ETH_GAS_CUSHION on each source.
 *
 * Env:
 *   FUNDING_EXPECTED_ADDRESS=0x74705c97E16205E6336370a6e5e06984288907aD
 *   BUYER_START=1 BUYER_COUNT=5   or BUYER_INDICES=6,7,8,9,10
 *   BUYER_ETH_GAS_CUSHION=0.003
 *   LIQ_ETH_GAS_CUSHION=0.003
 *   SWEEP_LIQUIDITY=1         (set 0 to skip Liquidity wallet)
 *   SWEEP_TREASURY=0          (set 1 + TREASURY_PRIVATE_KEY to include Treasury)
 *   SWEEP_DEPLOYER=0         (set 1 + DEPLOYER_PRIVATE_KEY to include Deployer)
 *   DRY_RUN=1
 */
import { Wallet, formatEther, parseEther } from "ethers";
import { ethers, network } from "hardhat";
import { getLiquidityWalletSigner } from "./lib/signer";
import { resolveBuyerIndices } from "./lib/buyer-indices";

const ROBINHOOD_CHAIN_ID = 4663;
const DEFAULT_FUNDING = "0x74705c97E16205E6336370a6e5e06984288907aD";

function walletFromEnv(envName: string): Wallet {
  const raw = process.env[envName]?.trim();
  if (!raw) throw new Error(`Missing ${envName}`);
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  try {
    return new Wallet(normalized, ethers.provider);
  } catch {
    throw new Error(`${envName} is not a valid private key (details withheld).`);
  }
}

async function sweepFrom(label: string, wallet: Wallet, to: string, cushion: bigint, isDryRun: boolean): Promise<bigint> {
  const addr = await wallet.getAddress();
  const bal = await ethers.provider.getBalance(addr);
  if (bal <= cushion) {
    console.log(`${label} ${addr}: skip (bal ${formatEther(bal)} <= cushion ${formatEther(cushion)})`);
    return 0n;
  }
  const send = bal - cushion;
  console.log(`${label} → funding: ${formatEther(send)} ETH (leave ${formatEther(cushion)})`);
  if (!isDryRun) {
    const tx = await wallet.sendTransaction({ to, value: send });
    console.log(`  tx ${tx.hash}`);
    await tx.wait();
  }
  return send;
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected ${ROBINHOOD_CHAIN_ID}, got ${chainId}`);
  }

  const isDryRun = process.env.DRY_RUN === "1";
  const fundingAddr = ethers.getAddress(process.env.FUNDING_EXPECTED_ADDRESS?.trim() || DEFAULT_FUNDING);
  const buyerCushion = parseEther(process.env.BUYER_ETH_GAS_CUSHION ?? "0.003");
  const liqCushion = parseEther(process.env.LIQ_ETH_GAS_CUSHION ?? "0.003");

  console.log(`Network ${network.name} (${chainId}) DRY_RUN=${isDryRun ? "yes" : "NO"}`);
  console.log(`Destination funding: ${fundingAddr}`);

  const before = await ethers.provider.getBalance(fundingAddr);
  console.log(`Funding before: ${formatEther(before)} ETH`);

  let total = 0n;

  if (process.env.SWEEP_LIQUIDITY !== "0") {
    const liq = await getLiquidityWalletSigner(ethers.provider);
    total += await sweepFrom("Liquidity", liq, fundingAddr, liqCushion, isDryRun);
  }

  const buyerIndices = resolveBuyerIndices();
  for (const i of buyerIndices) {
    const buyer = walletFromEnv(`BUYER_${i}_PRIVATE_KEY`);
    total += await sweepFrom(`Buyer${i}`, buyer, fundingAddr, buyerCushion, isDryRun);
  }

  if (process.env.SWEEP_TREASURY === "1") {
    const { getTreasurySigner } = await import("./lib/signer");
    const treasury = await getTreasurySigner(ethers.provider);
    total += await sweepFrom("Treasury", treasury, fundingAddr, buyerCushion, isDryRun);
  }

  if (process.env.SWEEP_DEPLOYER === "1") {
    const { getDeployerSigner } = await import("./lib/signer");
    const deployer = await getDeployerSigner(ethers.provider);
    total += await sweepFrom("Deployer", deployer, fundingAddr, buyerCushion, isDryRun);
  }

  const afterRaw = await ethers.provider.getBalance(fundingAddr);
  const after = isDryRun ? afterRaw + total : afterRaw;

  console.log("");
  console.log(`Swept (gross): ${formatEther(total)} ETH`);
  console.log(`Funding after: ${formatEther(after)} ETH`);
  if (isDryRun) console.log("DRY_RUN — no txs sent");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
