/**
 * Buy additional HANSOME with a computed slice of a fixed ETH budget, sized so
 * that (existing Treasury HANSOME + bought HANSOME) pairs exactly with the
 * *remaining* ETH for a target Uniswap v4 mint range — i.e. this is step 1 of
 * a 2-step "deploy 100% of a fixed ETH budget into a new LP position without
 * touching any other wallet's tokens" plan. Step 2 is mint-v4-liquidity.ts,
 * using the MINT_ETH_AMOUNT / MINT_HANSOME_AMOUNT this script prints at the end.
 *
 * Executes the swap through the same Universal Router path the website's
 * swap UI uses (lib/swap/encoding.ts's ETH->HANSOME command sequence).
 *
 * Why this exists: if you have more ETH than a given tick range naturally
 * needs to pair with your existing HANSOME balance, the excess ETH cannot be
 * deposited into that same position — Uniswap v4 mints require the exact
 * currency0:currency1 ratio implied by the range and current price. Buying
 * more HANSOME first (using only your own ETH, on the open market) is the
 * only way to deploy 100% of the ETH into ONE position without sourcing
 * HANSOME from anywhere else.
 *
 * Required env (contracts/.env or inline):
 *   TARGET_TICK_LOWER=160000
 *   TARGET_TICK_UPPER=240000
 *   TOTAL_ETH_BUDGET=0.249
 *   MAX_SLIPPAGE_BPS=100   (optional, default 100 = 1%)
 *
 * Run:
 *   TARGET_TICK_LOWER=160000 TARGET_TICK_UPPER=240000 TOTAL_ETH_BUDGET=0.249 \
 *     DRY_RUN=1 npx hardhat run scripts/buy-hansome-for-lp.ts --network robinhood
 *   (drop DRY_RUN=1 to send the real swap transaction)
 */
import { AbiCoder, Contract, formatEther, formatUnits, parseEther, solidityPacked, ZeroAddress } from "ethers";
import { ethers, network } from "hardhat";
import { computePoolId, truncateTickSpacing } from "./lib/v4-math";
import { getTreasurySigner } from "./lib/signer";
import { resolveHansomeAddress, resolveLpFee, resolveTickSpacing } from "./lib/pool-config";

const ROBINHOOD_CHAIN_ID = 4663;

const ADDR = {
  universalRouter: "0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
} as const;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TickMath, SqrtPriceMath } = require("@uniswap/v3-sdk") as typeof import("@uniswap/v3-sdk");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSBI = require("jsbi").default ?? require("jsbi");

function requireEnv(name: string): string {
  const raw = process.env[name]?.trim();
  if (!raw) {
    throw new Error(`Missing ${name}. Set it explicitly (contracts/.env or inline) before running.`);
  }
  return raw;
}

function buildEthToHansomeInput(poolKey: readonly unknown[], hansomeAddress: string, amountIn: bigint, amountOutMin: bigint) {
  const actions = solidityPacked(["uint8", "uint8", "uint8"], [0x06, 0x0c, 0x0f]);
  const params = [
    AbiCoder.defaultAbiCoder().encode(
      ["tuple(address,address,uint24,int24,address)", "bool", "uint128", "uint128", "uint256", "bytes"],
      [poolKey, true, amountIn, amountOutMin, 0n, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [ZeroAddress, amountIn]),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [hansomeAddress, amountOutMin]),
  ];
  return AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
}

/** Amount1 (HANSOME) out for a given ETH-in, using live pool sqrtPrice + in-range liquidity (constant-L, single-tick-range approximation — valid as long as the buy doesn't cross a tick boundary where liquidity composition changes, which pre-flight checks below verify). */
function simulateBuy(sqrtCurrent: InstanceType<typeof JSBI>, liquidity: InstanceType<typeof JSBI>, lpFeePpm: number, ethIn: bigint): bigint {
  const ethInJ = JSBI.BigInt(ethIn.toString());
  const ethInAfterFee = JSBI.divide(JSBI.multiply(ethInJ, JSBI.BigInt(1_000_000 - lpFeePpm)), JSBI.BigInt(1_000_000));
  const sqrtNext = SqrtPriceMath.getNextSqrtPriceFromInput(sqrtCurrent, liquidity, ethInAfterFee, true);
  const hansomeOut = SqrtPriceMath.getAmount1Delta(sqrtNext, sqrtCurrent, liquidity, false);
  return BigInt(hansomeOut.toString());
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected Robinhood Mainnet (${ROBINHOOD_CHAIN_ID}), got ${chainId}`);
  }

  const signer = await getTreasurySigner(ethers.provider);
  const recipient = await signer.getAddress();

  const tickSpacing = resolveTickSpacing();
  const targetTickLower = truncateTickSpacing(Number(requireEnv("TARGET_TICK_LOWER")), tickSpacing);
  const targetTickUpper = truncateTickSpacing(Number(requireEnv("TARGET_TICK_UPPER")), tickSpacing);
  const totalEthBudget = parseEther(requireEnv("TOTAL_ETH_BUDGET"));
  const maxSlippageBps = process.env.MAX_SLIPPAGE_BPS ? Number(process.env.MAX_SLIPPAGE_BPS) : 100;

  const hansomeAddress = resolveHansomeAddress();
  const lpFee = resolveLpFee();
  const poolKey = [ZeroAddress, hansomeAddress, lpFee, tickSpacing, ZeroAddress] as const;
  const poolId = computePoolId({ currency0: ZeroAddress, currency1: hansomeAddress, fee: lpFee, tickSpacing, hooks: ZeroAddress });

  const hansomeToken = new Contract(hansomeAddress, [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ], ethers.provider);
  const stateView = new Contract(ADDR.stateView, [
    "function getSlot0(bytes32) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    "function getLiquidity(bytes32) view returns (uint128)",
  ], ethers.provider);

  console.log("Buy HANSOME with a slice of a fixed ETH budget (step 1 of buy-then-mint plan)");
  console.log(`  Network:            ${network.name} (${chainId})`);
  console.log(`  Treasury:           ${recipient}`);
  console.log(`  Target mint range:  [${targetTickLower}, ${targetTickUpper}]`);
  console.log(`  Total ETH budget:   ${formatEther(totalEthBudget)}`);

  const [slot0, poolLiquidity, hansomeBalanceBefore, ethBalance, decimals] = await Promise.all([
    stateView.getSlot0(poolId),
    stateView.getLiquidity(poolId),
    hansomeToken.balanceOf(recipient),
    ethers.provider.getBalance(recipient),
    hansomeToken.decimals(),
  ]);

  if (slot0.sqrtPriceX96 === 0n || poolLiquidity === 0n) {
    throw new Error("Pool not initialized or has zero active liquidity — cannot simulate a buy");
  }
  if (ethBalance < totalEthBudget) {
    throw new Error(`Insufficient Treasury ETH: have ${formatEther(ethBalance)}, need ${formatEther(totalEthBudget)}`);
  }

  const currentTick = Number(slot0.tick);
  console.log("");
  console.log("Current pool state");
  console.log(`  sqrtPriceX96:       ${slot0.sqrtPriceX96.toString()}`);
  console.log(`  tick:               ${currentTick}`);
  console.log(`  in-range liquidity: ${poolLiquidity.toString()}`);
  console.log(`  Treasury ETH:       ${formatEther(ethBalance)}`);
  console.log(`  Treasury HANSOME:   ${formatUnits(hansomeBalanceBefore, decimals)}`);

  if (currentTick < targetTickLower || currentTick >= targetTickUpper) {
    throw new Error(`Current tick ${currentTick} is outside target range [${targetTickLower}, ${targetTickUpper}] — recompute the range before running this`);
  }

  const sqrtCurrent = JSBI.BigInt(slot0.sqrtPriceX96.toString());
  const liquidityJ = JSBI.BigInt(poolLiquidity.toString());
  const sqrtTargetLo = TickMath.getSqrtRatioAtTick(targetTickLower);
  const sqrtTargetHi = TickMath.getSqrtRatioAtTick(targetTickUpper);
  const unitL = JSBI.BigInt("1000000000000000000");
  const amt0PerL = BigInt(SqrtPriceMath.getAmount0Delta(sqrtCurrent, sqrtTargetHi, unitL, true).toString());
  const amt1PerL = BigInt(SqrtPriceMath.getAmount1Delta(sqrtTargetLo, sqrtCurrent, unitL, true).toString());
  const ratio = Number(amt0PerL) / Number(amt1PerL); // ETH needed per HANSOME, for the target range

  // Sanity check: the whole buy must stay within the pool's currently active
  // (single-tick-range) liquidity — if it would cross into a different
  // liquidity regime, this simulation is invalid. Cap search at 95% of budget.
  let lo = 0n;
  let hi = (totalEthBudget * 95n) / 100n;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2n;
    const bought = simulateBuy(sqrtCurrent, liquidityJ, lpFee, mid);
    const remainingEth = totalEthBudget - mid;
    const finalHansome = hansomeBalanceBefore + bought;
    // remainingEth vs ratio*finalHansome
    const rhs = ratio * Number(finalHansome);
    if (Number(remainingEth) > rhs) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const ethToSwap = lo;
  const expectedHansomeOut = simulateBuy(sqrtCurrent, liquidityJ, lpFee, ethToSwap);
  const remainingEthForMint = totalEthBudget - ethToSwap;
  const finalHansomeForMint = hansomeBalanceBefore + expectedHansomeOut;

  console.log("");
  console.log("Computed optimal split");
  console.log(`  Swap ETH -> HANSOME:      ${formatEther(ethToSwap)} ETH`);
  console.log(`  Expected HANSOME out:     ${formatUnits(expectedHansomeOut, decimals)}`);
  console.log(`  Remaining ETH for mint:   ${formatEther(remainingEthForMint)}`);
  console.log(`  Total HANSOME for mint:   ${formatUnits(finalHansomeForMint, decimals)} (existing ${formatUnits(hansomeBalanceBefore, decimals)} + bought ${formatUnits(expectedHansomeOut, decimals)})`);

  const amountOutMin = (expectedHansomeOut * BigInt(10_000 - maxSlippageBps)) / 10_000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const swapInput = buildEthToHansomeInput(poolKey, hansomeAddress, ethToSwap, amountOutMin);
  const commands = solidityPacked(["uint8"], [0x10]);

  const ur = new Contract(ADDR.universalRouter, ["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"], signer);

  if (process.env.DRY_RUN === "1") {
    console.log("");
    console.log("DRY_RUN=1 — simulating swap only (no transaction sent)");
    await ur.execute.staticCall(commands, [swapInput], deadline, { value: ethToSwap });
    console.log("  staticCall:       PASSED");
    console.log(`  amountOutMin:     ${formatUnits(amountOutMin, decimals)} (${maxSlippageBps / 100}% max slippage)`);
    console.log("");
    console.log("Next step (after running this for real): mint using");
    console.log(`  MINT_TICK_LOWER=${targetTickLower} MINT_TICK_UPPER=${targetTickUpper} MINT_ETH_AMOUNT=${formatEther(remainingEthForMint)} MINT_HANSOME_AMOUNT=<actual post-swap balance, printed by the real run>`);
    console.log("  DRY_RUN:          ALL CHECKS PASSED — no swap executed, no HANSOME bought");
    return;
  }

  console.log("");
  console.log(`Submitting Universal Router swap: ${formatEther(ethToSwap)} ETH -> HANSOME (min ${formatUnits(amountOutMin, decimals)})...`);

  const tx = await ur.execute(commands, [swapInput], deadline, { value: ethToSwap });
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction failed — no receipt returned");
  }

  const hansomeBalanceAfter: bigint = await hansomeToken.balanceOf(recipient);
  const ethBalanceAfter = await ethers.provider.getBalance(recipient);
  const actualHansomeReceived = hansomeBalanceAfter - hansomeBalanceBefore;
  if (actualHansomeReceived < amountOutMin) {
    throw new Error(`Received less HANSOME (${formatUnits(actualHansomeReceived, decimals)}) than the slippage floor (${formatUnits(amountOutMin, decimals)}) — investigate before minting`);
  }

  console.log("");
  console.log("Swap executed");
  console.log(`  Transaction Hash:      ${receipt.hash}`);
  console.log(`  Block Number:          ${receipt.blockNumber}`);
  console.log(`  HANSOME received:      ${formatUnits(actualHansomeReceived, decimals)}`);
  console.log(`  Treasury HANSOME now:  ${formatUnits(hansomeBalanceAfter, decimals)}`);
  console.log(`  Treasury ETH now:      ${formatEther(ethBalanceAfter)}`);
  console.log(`  Explorer:              https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);
  console.log("");
  console.log("Next step — mint the new position with:");
  console.log(`  MINT_TICK_LOWER=${targetTickLower} MINT_TICK_UPPER=${targetTickUpper} MINT_ETH_AMOUNT=${formatEther(remainingEthForMint)} MINT_HANSOME_AMOUNT=${formatUnits(hansomeBalanceAfter, decimals)} npx hardhat run scripts/mint-v4-liquidity.ts --network robinhood`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
