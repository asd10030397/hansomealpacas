/**
 * Read-only helper: reads Treasury's CURRENT ETH + HANSOME balance and
 * computes the exact 85/15 narrow/wide split for the barbell mint steps.
 *
 * Meant to be run immediately after Steps 1 (withdraw #129055), 2 (external
 * buy), and 2.5 (transfer-hansome-to-treasury.ts) have landed for real, so
 * the MINT_ETH_AMOUNT / MINT_HANSOME_AMOUNT values for Steps 3 and 4 are
 * always computed from live post-buy balances — never from stale
 * projections — with zero manual arithmetic and minimal delay.
 *
 * No transaction is ever sent — this only reads state.
 *
 * Run:
 *   npx hardhat run scripts/compute-barbell-split.ts --network robinhood
 *
 * Optional env overrides:
 *   GAS_RESERVE_ETH=0.006      (reserved for the 2 mint txs + 2 approvals)
 *   SPLIT_NARROW_BPS=8500      (85% narrow / 15% wide)
 *   NARROW_TICK_LOWER=194740
 *   NARROW_TICK_UPPER=197750
 *   WIDE_TICK_LOWER=160000
 *   WIDE_TICK_UPPER=240000
 */
import { Contract, formatEther, formatUnits, parseEther } from "ethers";
import { ethers } from "hardhat";
import { resolveHansomeAddress } from "./lib/pool-config";

const TREASURY = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";

async function main() {
  const hansomeAddress = resolveHansomeAddress();
  const hansomeToken = new Contract(
    hansomeAddress,
    ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
    ethers.provider,
  );

  const gasReserve = parseEther(process.env.GAS_RESERVE_ETH ?? "0.006");
  const narrowBps = BigInt(process.env.SPLIT_NARROW_BPS ?? "8500");
  const narrowTL = process.env.NARROW_TICK_LOWER ?? "194740";
  const narrowTU = process.env.NARROW_TICK_UPPER ?? "197750";
  const wideTL = process.env.WIDE_TICK_LOWER ?? "160000";
  const wideTU = process.env.WIDE_TICK_UPPER ?? "240000";

  const [ethBalance, hansomeBalance, decimals] = await Promise.all([
    ethers.provider.getBalance(TREASURY),
    hansomeToken.balanceOf(TREASURY),
    hansomeToken.decimals(),
  ]);

  console.log(`Treasury: ${TREASURY}`);
  console.log(`  ETH balance:     ${formatEther(ethBalance)}`);
  console.log(`  HANSOME balance: ${formatUnits(hansomeBalance, decimals)}`);

  if (ethBalance <= gasReserve) {
    throw new Error(
      `Treasury ETH balance (${formatEther(ethBalance)}) is at or below the gas reserve (${formatEther(gasReserve)}) — ` +
        "Steps 1-2 probably haven't landed yet, or the reserve is set too high.",
    );
  }
  if (hansomeBalance === 0n) {
    throw new Error("Treasury HANSOME balance is 0 — Step 2.5 (transfer-hansome-to-treasury.ts) probably hasn't landed yet.");
  }

  const ethUsable = ethBalance - gasReserve;
  const totalEth = ethUsable;
  const totalHansome = hansomeBalance;

  const narrowEth = (totalEth * narrowBps) / 10000n;
  const narrowHansome = (totalHansome * narrowBps) / 10000n;
  const wideEth = totalEth - narrowEth;
  const wideHansome = totalHansome - narrowHansome;

  console.log("");
  console.log(`Gas reserve:       ${formatEther(gasReserve)} ETH (held back, not allocated)`);
  console.log(`Usable total:      ${formatEther(totalEth)} ETH + ${formatUnits(totalHansome, decimals)} HANSOME`);
  console.log(`Split:             ${Number(narrowBps) / 100}% narrow / ${100 - Number(narrowBps) / 100}% wide`);

  console.log("");
  console.log("=== Step 3: mint NARROW ===");
  console.log(
    `MINT_TICK_LOWER=${narrowTL} MINT_TICK_UPPER=${narrowTU} MINT_ETH_AMOUNT=${formatEther(narrowEth)} MINT_HANSOME_AMOUNT=${formatUnits(narrowHansome, decimals)} npx hardhat run scripts/mint-v4-liquidity.ts --network robinhood`,
  );

  console.log("");
  console.log("=== Step 4: mint WIDE ===");
  console.log(
    `MINT_TICK_LOWER=${wideTL} MINT_TICK_UPPER=${wideTU} MINT_ETH_AMOUNT=${formatEther(wideEth)} MINT_HANSOME_AMOUNT=${formatUnits(wideHansome, decimals)} npx hardhat run scripts/mint-v4-liquidity.ts --network robinhood`,
  );

  console.log("");
  console.log("Prepend DRY_RUN=1 to either command above to verify staticCall before sending the real transaction.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
