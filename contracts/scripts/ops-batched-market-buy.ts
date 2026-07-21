/**
 * Batched ETH -> HANSOME market buys from the official Liquidity Wallet.
 *
 * Uses LIQUIDITY_PRIVATE_KEY in contracts/.env (gitignored). Never paste the
 * key into chat. Never commit .env.
 *
 * Required env:
 *   LIQUIDITY_PRIVATE_KEY=0x...
 *   LIQUIDITY_EXPECTED_ADDRESS=0x0bd54aeE53E9603375C27940d74e7c0923573b2a
 *   BUY_BATCHES=0.25,0.30,0.35,0.40,0.40
 *
 * Optional:
 *   MAX_SLIPPAGE_BPS=200
 *   BATCH_DELAY_MS=180000          (wait between live batches; default 180s)
 *   DRY_RUN=1                     (simulate each batch, send nothing)
 *
 * Run (from contracts/):
 *   DRY_RUN=1 npx hardhat run scripts/ops-batched-market-buy.ts --network robinhood
 *   npx hardhat run scripts/ops-batched-market-buy.ts --network robinhood
 */
import { AbiCoder, Contract, formatEther, formatUnits, parseEther, solidityPacked, ZeroAddress } from "ethers";
import { ethers, network } from "hardhat";
import { computePoolId } from "./lib/v4-math";
import { getLiquidityWalletSigner } from "./lib/signer";
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
    throw new Error(`Missing ${name}. Set it in contracts/.env before running.`);
  }
  return raw;
}

function parseBatches(raw: string): bigint[] {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("BUY_BATCHES is empty — e.g. 0.25,0.30,0.35,0.40,0.40");
  }
  return parts.map((p) => parseEther(p));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected Robinhood Mainnet (${ROBINHOOD_CHAIN_ID}), got ${chainId}`);
  }

  const signer = await getLiquidityWalletSigner(ethers.provider);
  const buyer = await signer.getAddress();
  const batches = parseBatches(requireEnv("BUY_BATCHES"));
  const maxSlippageBps = process.env.MAX_SLIPPAGE_BPS ? Number(process.env.MAX_SLIPPAGE_BPS) : 200;
  const delayMs = process.env.BATCH_DELAY_MS ? Number(process.env.BATCH_DELAY_MS) : 180_000;
  const isDryRun = process.env.DRY_RUN === "1";

  const hansomeAddress = resolveHansomeAddress();
  const lpFee = resolveLpFee();
  const tickSpacing = resolveTickSpacing();
  const poolKey = [ZeroAddress, hansomeAddress, lpFee, tickSpacing, ZeroAddress] as const;
  const poolId = computePoolId({
    currency0: ZeroAddress,
    currency1: hansomeAddress,
    fee: lpFee,
    tickSpacing,
    hooks: ZeroAddress,
  });

  const hansomeToken = new Contract(
    hansomeAddress,
    ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
    ethers.provider,
  );
  const stateView = new Contract(
    ADDR.stateView,
    [
      "function getSlot0(bytes32) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
      "function getLiquidity(bytes32) view returns (uint128)",
    ],
    ethers.provider,
  );
  const ur = new Contract(
    ADDR.universalRouter,
    ["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"],
    signer,
  );

  const totalEth = batches.reduce((a, b) => a + b, 0n);
  const decimals: number = await hansomeToken.decimals();
  const ethBalance = await ethers.provider.getBalance(buyer);

  console.log("Batched Liquidity-wallet market buys");
  console.log(`  Network:   ${network.name} (${chainId})`);
  console.log(`  Buyer:     ${buyer}`);
  console.log(`  PoolId:    ${poolId}`);
  console.log(`  Batches:   ${batches.map((b) => formatEther(b)).join(" + ")} = ${formatEther(totalEth)} ETH`);
  console.log(`  Slippage:  ${maxSlippageBps / 100}%`);
  console.log(`  Mode:      ${isDryRun ? "DRY_RUN (no txs)" : "LIVE"}`);
  console.log(`  ETH bal:   ${formatEther(ethBalance)}`);

  if (!isDryRun && ethBalance < totalEth) {
    throw new Error(`Insufficient ETH: have ${formatEther(ethBalance)}, need ${formatEther(totalEth)} + gas`);
  }

  for (let i = 0; i < batches.length; i++) {
    const ethIn = batches[i]!;
    console.log("");
    console.log(`--- Batch ${i + 1}/${batches.length}: ${formatEther(ethIn)} ETH ---`);

    const [slot0, poolLiquidity, hansomeBefore] = await Promise.all([
      stateView.getSlot0(poolId),
      stateView.getLiquidity(poolId),
      hansomeToken.balanceOf(buyer),
    ]);

    if (slot0.sqrtPriceX96 === 0n || poolLiquidity === 0n) {
      throw new Error("Pool not initialized or has zero active liquidity");
    }

    const sqrtCurrent = JSBI.BigInt(slot0.sqrtPriceX96.toString());
    const liquidityJ = JSBI.BigInt(poolLiquidity.toString());
    const ethInAfterFee = JSBI.divide(
      JSBI.multiply(JSBI.BigInt(ethIn.toString()), JSBI.BigInt(1_000_000 - lpFee)),
      JSBI.BigInt(1_000_000),
    );
    const sqrtNext = SqrtPriceMath.getNextSqrtPriceFromInput(sqrtCurrent, liquidityJ, ethInAfterFee, true);
    const expectedHansomeOut = BigInt(SqrtPriceMath.getAmount1Delta(sqrtNext, sqrtCurrent, liquidityJ, false).toString());
    const amountOutMin = (expectedHansomeOut * BigInt(10_000 - maxSlippageBps)) / 10_000n;

    console.log(`  tick ${slot0.tick.toString()} → ~${TickMath.getTickAtSqrtRatio(sqrtNext).toString()}`);
    console.log(`  expected out ~${formatUnits(expectedHansomeOut, decimals)} (min ${formatUnits(amountOutMin, decimals)})`);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const swapInput = buildEthToHansomeInput(poolKey, hansomeAddress, ethIn, amountOutMin);
    const commands = solidityPacked(["uint8"], [0x10]);

    if (isDryRun) {
      await ur.execute.staticCall(commands, [swapInput], deadline, { value: ethIn });
      console.log("  staticCall: PASSED");
    } else {
      const tx = await ur.execute(commands, [swapInput], deadline, { value: ethIn });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("No receipt");
      const hansomeAfter: bigint = await hansomeToken.balanceOf(buyer);
      console.log(`  tx: ${receipt.hash}`);
      console.log(`  received: ${formatUnits(hansomeAfter - hansomeBefore, decimals)} HANSOME`);
      console.log(`  explorer: https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);

      if (i < batches.length - 1 && delayMs > 0) {
        console.log(`  waiting ${delayMs}ms before next batch...`);
        await sleep(delayMs);
      }
    }
  }

  console.log("");
  console.log(isDryRun ? "DRY_RUN complete — no ETH spent." : "All batches submitted.");
  console.log("Next: transfer 100M HANSOME from #1 → Liquidity, then mint LP (mint-v4-liquidity.ts).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
