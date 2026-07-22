/**
 * Fund ETH from a dedicated funding wallet → Liquidity + N buyer wallets.
 *
 * You create/add the funding key yourself in contracts/.env (gitignored).
 * Never paste private keys into chat. Never commit .env.
 *
 * Env:
 *   FUNDING_PRIVATE_KEY              (required — your new transfer account)
 *   FUNDING_EXPECTED_ADDRESS=0x...   (optional safety check)
 *   FUNDING_ETH_GAS_RESERVE=0.02     (left on funding wallet after sends)
 *   FUND_ETH_LP=0.5                  (ETH → Liquidity; set 0 for buyers-only wave)
 *   FUND_ETH_BUYERS=0.281,0.328,...  (length must match buyer indices)
 *   BUYER_START=1 BUYER_COUNT=5      (default) or BUYER_INDICES=6,7,8,9,10
 *   LIQUIDITY_EXPECTED_ADDRESS=0x0bd54aeE53E9603375C27940d74e7c0923573b2a
 *   BUYER_N_PRIVATE_KEY or BUYER_N_ADDRESS for each index
 *   DRY_RUN=1
 *
 * Run (from contracts/):
 *   DRY_RUN=1 npx hardhat run scripts/ops-fund-eth-to-lp-and-buyers.ts --network robinhood
 *   BUYER_START=6 BUYER_COUNT=5 FUND_ETH_LP=0 npx hardhat run scripts/ops-fund-eth-to-lp-and-buyers.ts --network robinhood
 */
import { Wallet, formatEther, parseEther } from "ethers";
import { ethers, network } from "hardhat";
import { parseEthAmountList, resolveBuyerIndices } from "./lib/buyer-indices";

const ROBINHOOD_CHAIN_ID = 4663;
const DEFAULT_LIQUIDITY = "0x0bd54aeE53E9603375C27940d74e7c0923573b2a";

function requireEnv(name: string): string {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`Missing ${name} in contracts/.env`);
  return raw;
}

function walletFromEnv(envName: string): Wallet {
  const raw = requireEnv(envName);
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  try {
    return new Wallet(normalized, ethers.provider);
  } catch {
    throw new Error(`${envName} is not a valid private key (details withheld).`);
  }
}

async function resolveBuyerAddress(i: number): Promise<string> {
  const addrEnv = process.env[`BUYER_${i}_ADDRESS`]?.trim();
  if (addrEnv) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addrEnv)) {
      throw new Error(`BUYER_${i}_ADDRESS is not a valid address`);
    }
    return ethers.getAddress(addrEnv);
  }
  const keyEnv = process.env[`BUYER_${i}_PRIVATE_KEY`]?.trim();
  if (keyEnv) {
    const w = walletFromEnv(`BUYER_${i}_PRIVATE_KEY`);
    return w.getAddress();
  }
  throw new Error(`Set BUYER_${i}_ADDRESS or BUYER_${i}_PRIVATE_KEY`);
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected ${ROBINHOOD_CHAIN_ID}, got ${chainId}`);
  }

  const isDryRun = process.env.DRY_RUN === "1";
  const funding = walletFromEnv("FUNDING_PRIVATE_KEY");
  const fundingAddr = await funding.getAddress();
  const expectedFunding = process.env.FUNDING_EXPECTED_ADDRESS?.trim();
  if (expectedFunding && fundingAddr.toLowerCase() !== expectedFunding.toLowerCase()) {
    throw new Error(
      `FUNDING_PRIVATE_KEY derives ${fundingAddr}, expected ${expectedFunding}`,
    );
  }

  const buyerIndices = resolveBuyerIndices();
  const liquidityAddr = ethers.getAddress(
    process.env.LIQUIDITY_EXPECTED_ADDRESS?.trim() || DEFAULT_LIQUIDITY,
  );
  const lpEth = parseEther(process.env.FUND_ETH_LP?.trim() || "0.5");
  const defaultBuyers =
    buyerIndices.length === 5 && buyerIndices[0] === 1
      ? "0.281,0.328,0.304,0.397,0.440"
      : undefined;
  const buyersRaw = process.env.FUND_ETH_BUYERS?.trim() || defaultBuyers;
  if (!buyersRaw) {
    throw new Error(
      `Set FUND_ETH_BUYERS with exactly ${buyerIndices.length} amounts for buyers [${buyerIndices.join(",")}]`,
    );
  }
  const buyerAmounts = parseEthAmountList(buyersRaw, buyerIndices.length, "FUND_ETH_BUYERS");
  const gasReserve = parseEther(process.env.FUNDING_ETH_GAS_RESERVE?.trim() || "0.02");

  const buyerAddrs: string[] = [];
  for (const i of buyerIndices) {
    buyerAddrs.push(await resolveBuyerAddress(i));
  }

  const totalBuyers = buyerAmounts.reduce((a, b) => a + b, 0n);
  const totalOut = lpEth + totalBuyers;
  const need = totalOut + gasReserve;
  const ethBal = await ethers.provider.getBalance(fundingAddr);

  console.log(`Fund ETH: funding wallet → Liquidity + ${buyerIndices.length} buyers`);
  console.log(`  Network:  ${network.name} (${chainId})`);
  console.log(`  Funding:  ${fundingAddr}`);
  console.log(`  Buyers:   [${buyerIndices.join(", ")}]`);
  console.log(`  Mode:     ${isDryRun ? "DRY_RUN" : "LIVE"}`);
  console.log("");
  console.log("Destinations");
  console.log(`  LP:       ${liquidityAddr}  ← ${formatEther(lpEth)} ETH`);
  for (let i = 0; i < buyerIndices.length; i++) {
    console.log(
      `  Buyer ${buyerIndices[i]}: ${buyerAddrs[i]}  ← ${formatEther(buyerAmounts[i]!)} ETH`,
    );
  }
  console.log("");
  console.log("Totals");
  console.log(`  To LP:       ${formatEther(lpEth)} ETH`);
  console.log(`  To buyers:   ${formatEther(totalBuyers)} ETH`);
  console.log(`  Gas reserve: ${formatEther(gasReserve)} ETH`);
  console.log(`  Need total:  ${formatEther(need)} ETH`);
  console.log(`  Funding bal: ${formatEther(ethBal)} ETH`);

  if (ethBal < need) {
    throw new Error(
      `Insufficient ETH on funding wallet: have ${formatEther(ethBal)}, need ${formatEther(need)}`,
    );
  }

  if (isDryRun) {
    console.log("");
    console.log("DRY_RUN — no transfers sent.");
    return;
  }

  console.log("");
  console.log(`Transfer ETH → Liquidity (${formatEther(lpEth)})...`);
  {
    const tx = await funding.sendTransaction({ to: liquidityAddr, value: lpEth });
    await tx.wait();
    console.log(`  ${tx.hash}`);
  }

  for (let i = 0; i < buyerIndices.length; i++) {
    const to = buyerAddrs[i]!;
    const value = buyerAmounts[i]!;
    console.log(`Transfer ETH → Buyer ${buyerIndices[i]} (${formatEther(value)})...`);
    const tx = await funding.sendTransaction({ to, value });
    await tx.wait();
    console.log(`  ${tx.hash}`);
  }

  const left = await ethers.provider.getBalance(fundingAddr);
  console.log("");
  console.log(`Funding complete. Remaining on funding wallet: ${formatEther(left)} ETH`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
