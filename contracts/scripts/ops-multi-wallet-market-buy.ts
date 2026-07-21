/**
 * Five wallets each execute one ETH→HANSOME market-buy batch.
 *
 * Env:
 *   BUYER_1_PRIVATE_KEY ... BUYER_5_PRIVATE_KEY
 *   BUY_BATCHES=0.271,0.318,0.294,0.387,0.430   (exactly 5; sum ≈ budget)
 *   MAX_SLIPPAGE_BPS=200
 *   SHUFFLE_BUYERS=1          (random wallet order + shuffle amounts onto wallets)
 *   BATCH_WINDOW_MS=60000     (all 5 buys finish within this window; random gaps)
 *   DRY_RUN=1
 *
 * Run:
 *   DRY_RUN=1 npx hardhat run scripts/ops-multi-wallet-market-buy.ts --network robinhood
 *   npx hardhat run scripts/ops-multi-wallet-market-buy.ts --network robinhood
 */
import { AbiCoder, Contract, Wallet, formatEther, formatUnits, parseEther, solidityPacked, ZeroAddress } from "ethers";
import { ethers, network } from "hardhat";
import { computePoolId } from "./lib/v4-math";
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

type Job = {
  index: number;
  signer: Wallet;
  address: string;
  ethIn: bigint;
  atMs: number;
};

function requireEnv(name: string): string {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`Missing ${name}`);
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

function parseBatches(raw: string): bigint[] {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 5) {
    throw new Error(`BUY_BATCHES must have exactly 5 amounts, got ${parts.length}`);
  }
  return parts.map((p) => parseEther(p));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

/** Five random offsets in [0, windowMs], sorted ascending. */
function randomScheduleMs(windowMs: number, count: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < count; i++) {
    points.push(Math.floor(Math.random() * (windowMs + 1)));
  }
  points.sort((a, b) => a - b);
  // Ensure first buy isn't always at t=0 — already random; if all collide, nudge later ones
  for (let i = 1; i < points.length; i++) {
    if (points[i]! <= points[i - 1]!) {
      points[i] = Math.min(windowMs, points[i - 1]! + 1 + Math.floor(Math.random() * 3_000));
    }
  }
  points.sort((a, b) => a - b);
  return points;
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
    throw new Error(`Wrong network: expected ${ROBINHOOD_CHAIN_ID}, got ${chainId}`);
  }

  const isDryRun = process.env.DRY_RUN === "1";
  const batches = parseBatches(requireEnv("BUY_BATCHES"));
  const maxSlippageBps = process.env.MAX_SLIPPAGE_BPS ? Number(process.env.MAX_SLIPPAGE_BPS) : 200;
  const shuffle = process.env.SHUFFLE_BUYERS !== "0";
  const windowMs = process.env.BATCH_WINDOW_MS
    ? Number(process.env.BATCH_WINDOW_MS)
    : process.env.BATCH_DELAY_MS
      ? Number(process.env.BATCH_DELAY_MS)
      : 60_000;

  const buyers = [1, 2, 3, 4, 5].map((i) => walletFromEnv(`BUYER_${i}_PRIVATE_KEY`));
  const buyerAddrs = await Promise.all(buyers.map((b) => b.getAddress()));

  // Pair buyer i with batch i, then shuffle pairs so order + amount assignment look organic.
  const pairs = buyers.map((signer, i) => ({
    index: i + 1,
    signer,
    address: buyerAddrs[i]!,
    ethIn: batches[i]!,
  }));
  if (shuffle) {
    shuffleInPlace(pairs);
    // Also reshuffle amounts onto the (already shuffled) wallets for extra messiness
    const amounts = pairs.map((p) => p.ethIn);
    shuffleInPlace(amounts);
    for (let i = 0; i < pairs.length; i++) {
      pairs[i]!.ethIn = amounts[i]!;
    }
  }

  const schedule = randomScheduleMs(windowMs, 5);
  const jobs: Job[] = pairs.map((p, i) => ({
    ...p,
    atMs: schedule[i]!,
  }));

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

  const decimals: number = await hansomeToken.decimals();
  const totalEth = batches.reduce((a, b) => a + b, 0n);

  console.log("Multi-wallet market buys (random order, ~1 min window)");
  console.log(`  Network:  ${network.name} (${chainId})`);
  console.log(`  PoolId:   ${poolId}`);
  console.log(`  Total:    ${formatEther(totalEth)} ETH`);
  console.log(`  Shuffle:  ${shuffle}`);
  console.log(`  Window:   ${windowMs}ms`);
  console.log(`  Mode:     ${isDryRun ? "DRY_RUN" : "LIVE"}`);
  console.log("");
  console.log("Schedule (this run):");
  for (const j of jobs) {
    console.log(`  t+${(j.atMs / 1000).toFixed(1)}s  Buyer ${j.index} ${j.address}  ${formatEther(j.ethIn)} ETH`);
  }
  console.log("");

  const started = Date.now();

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]!;
    const waitUntil = started + job.atMs;
    const waitMs = waitUntil - Date.now();
    if (!isDryRun && waitMs > 0) {
      console.log(`waiting ${(waitMs / 1000).toFixed(1)}s until Buyer ${job.index}...`);
      await sleep(waitMs);
    }

    const ethBal = await ethers.provider.getBalance(job.address);
    console.log(
      `--- t+${((Date.now() - started) / 1000).toFixed(1)}s Buyer ${job.index}: ${job.address} | ${formatEther(job.ethIn)} ETH (bal ${formatEther(ethBal)}) ---`,
    );

    if (!isDryRun && ethBal < job.ethIn) {
      throw new Error(`Buyer ${job.index} insufficient ETH: have ${formatEther(ethBal)}, need ${formatEther(job.ethIn)} + gas`);
    }

    const [slot0, poolLiquidity, hansomeBefore] = await Promise.all([
      stateView.getSlot0(poolId),
      stateView.getLiquidity(poolId),
      hansomeToken.balanceOf(job.address),
    ]);
    if (slot0.sqrtPriceX96 === 0n || poolLiquidity === 0n) {
      throw new Error("Pool not ready");
    }

    const sqrtCurrent = JSBI.BigInt(slot0.sqrtPriceX96.toString());
    const liquidityJ = JSBI.BigInt(poolLiquidity.toString());
    const ethInAfterFee = JSBI.divide(
      JSBI.multiply(JSBI.BigInt(job.ethIn.toString()), JSBI.BigInt(1_000_000 - lpFee)),
      JSBI.BigInt(1_000_000),
    );
    const sqrtNext = SqrtPriceMath.getNextSqrtPriceFromInput(sqrtCurrent, liquidityJ, ethInAfterFee, true);
    const expectedHansomeOut = BigInt(SqrtPriceMath.getAmount1Delta(sqrtNext, sqrtCurrent, liquidityJ, false).toString());
    const amountOutMin = (expectedHansomeOut * BigInt(10_000 - maxSlippageBps)) / 10_000n;

    console.log(`  tick ${slot0.tick} → ~${TickMath.getTickAtSqrtRatio(sqrtNext)}`);
    console.log(`  expected ~${formatUnits(expectedHansomeOut, decimals)} HANSOME`);

    const ur = new Contract(
      ADDR.universalRouter,
      ["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"],
      job.signer,
    );
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const swapInput = buildEthToHansomeInput(poolKey, hansomeAddress, job.ethIn, amountOutMin);
    const commands = solidityPacked(["uint8"], [0x10]);

    if (isDryRun) {
      if (ethBal >= job.ethIn) {
        await ur.execute.staticCall(commands, [swapInput], deadline, { value: job.ethIn });
        console.log("  staticCall: PASSED");
      } else {
        console.log("  SKIP staticCall (buyer needs ETH) — fund before live run");
      }
    } else {
      const tx = await ur.execute(commands, [swapInput], deadline, { value: job.ethIn });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("No receipt");
      const hansomeAfter: bigint = await hansomeToken.balanceOf(job.address);
      console.log(`  tx: ${receipt.hash}`);
      console.log(`  received: ${formatUnits(hansomeAfter - hansomeBefore, decimals)}`);
      console.log(`  https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);
    }
  }

  console.log("");
  console.log(isDryRun ? "DRY_RUN complete." : "All 5 buys submitted.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
