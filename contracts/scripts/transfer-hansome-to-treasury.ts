/**
 * Transfer the external buyer wallet's ENTIRE HANSOME balance to Treasury.
 *
 * This is the missing link between market-buy-external.ts (buyer purchases
 * HANSOME on the open market) and mint-v4-liquidity.ts (Treasury mints new
 * LP positions) — the mint scripts sign as Treasury, so Treasury must
 * physically hold the HANSOME the buyer just bought before minting.
 *
 * The buyer's current on-chain HANSOME balance is read automatically —
 * nothing is hardcoded or assumed from a prior step's projected output.
 *
 * Run:
 *   DRY_RUN=1 npx hardhat run scripts/transfer-hansome-to-treasury.ts --network robinhood
 *   (drop DRY_RUN=1 to send the real transaction)
 */
import { Contract, formatUnits } from "ethers";
import { ethers, network } from "hardhat";
import { getExternalBuyerSigner } from "./lib/signer";
import { resolveHansomeAddress } from "./lib/pool-config";

const ROBINHOOD_CHAIN_ID = 4663;
const TREASURY = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";

const erc20Abi = [
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected Robinhood Mainnet (${ROBINHOOD_CHAIN_ID}), got ${chainId}`);
  }

  const signer = await getExternalBuyerSigner(ethers.provider);
  const buyer = await signer.getAddress();

  const hansomeAddress = resolveHansomeAddress();
  const hansomeToken = new Contract(hansomeAddress, erc20Abi, signer);

  const [symbol, decimals, buyerBalance, treasuryBalanceBefore] = await Promise.all([
    hansomeToken.symbol(),
    hansomeToken.decimals(),
    hansomeToken.balanceOf(buyer),
    hansomeToken.balanceOf(TREASURY),
  ]);

  console.log("Transfer buyer's HANSOME to Treasury");
  console.log(`  Network:           ${network.name} (${chainId})`);
  console.log(`  Token:             ${hansomeAddress} (${symbol}, decimals=${decimals})`);
  console.log(`  From (buyer):      ${buyer}`);
  console.log(`  To (Treasury):     ${TREASURY}`);
  console.log("");
  console.log("Pre-flight checks");
  console.log(`  Buyer balance:     ${formatUnits(buyerBalance, decimals)}`);
  console.log(`  Treasury balance (before): ${formatUnits(treasuryBalanceBefore, decimals)}`);

  if (buyerBalance === 0n) {
    throw new Error("Buyer HANSOME balance is 0 — nothing to transfer. Run market-buy-external.ts first.");
  }

  const isDryRun = process.env.DRY_RUN === "1";

  // eth_call simulates the full transfer (incl. any hooks/blacklist logic the
  // token might have) without sending a transaction or changing state.
  await hansomeToken.transfer.staticCall(TREASURY, buyerBalance);
  console.log("  staticCall:        PASSED");

  if (isDryRun) {
    console.log("");
    console.log("DRY_RUN=1 — simulating transfer (no transaction sent, no HANSOME moved)");
    console.log(`  Would transfer:    ${formatUnits(buyerBalance, decimals)} ${symbol}`);
    console.log(`  Treasury would become: ${formatUnits(treasuryBalanceBefore + buyerBalance, decimals)}`);
    console.log("  DRY_RUN:           ALL CHECKS PASSED — no HANSOME transferred");
    return;
  }

  console.log("");
  console.log(`Submitting transfer of ${formatUnits(buyerBalance, decimals)} ${symbol}...`);

  const tx = await hansomeToken.transfer(TREASURY, buyerBalance);
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction failed — no receipt returned");
  }

  const [buyerBalanceAfter, treasuryBalanceAfter] = await Promise.all([
    hansomeToken.balanceOf(buyer),
    hansomeToken.balanceOf(TREASURY),
  ]);

  if (buyerBalanceAfter !== 0n) {
    throw new Error(`Post-tx check failed: buyer still holds ${formatUnits(buyerBalanceAfter, decimals)} ${symbol}`);
  }
  const received = treasuryBalanceAfter - treasuryBalanceBefore;
  if (received !== buyerBalance) {
    throw new Error(
      `Post-tx check failed: Treasury received ${formatUnits(received, decimals)}, expected ${formatUnits(buyerBalance, decimals)} (transfer tax/hook on token?)`,
    );
  }

  console.log("");
  console.log("Transfer complete");
  console.log(`  Transaction Hash:   ${receipt.hash}`);
  console.log(`  Block Number:       ${receipt.blockNumber}`);
  console.log(`  Transferred:        ${formatUnits(received, decimals)} ${symbol}`);
  console.log(`  Buyer balance now:  ${formatUnits(buyerBalanceAfter, decimals)}`);
  console.log(`  Treasury balance now: ${formatUnits(treasuryBalanceAfter, decimals)}`);
  console.log(`  Explorer:           https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
