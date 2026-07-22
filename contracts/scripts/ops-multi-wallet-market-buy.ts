/**
 * N wallets each execute one ETH→HANSOME market-buy batch.
 *
 * Env:
 *   BUYER_START=1 BUYER_COUNT=5   or BUYER_INDICES=6,7,8,9,10
 *   BUYER_N_PRIVATE_KEY for each index
 *   BUY_BATCHES=0.271,0.318,...   (length must match buyer count; sum ≈ budget)
 *   MAX_SLIPPAGE_BPS=200          (tx minOut guard)
 *   MAX_LEG_SLIPPAGE_BPS=2500     (pre-trade spot slip; shrink/stop if exceeded)
 *   AUTO_SHRINK_LEG=1             (cut ethIn until under MAX_LEG_SLIPPAGE_BPS)
 *   FIT_TO_BALANCE=1              (cap ethIn to wallet bal − gas cushion)
 *   BUYER_ETH_GAS_CUSHION=0.005
 *   MIN_BUY_ETH=0.05
 *   MAX_BUYS=5                    (run only first N scheduled legs — wave control)
 *   SHUFFLE_BUYERS=1              (set 0 to keep Buyer i ↔ BUY_BATCHES[i])
 *   BATCH_WINDOW_MS=60000
 *   DRY_RUN=1
 *
 * Adaptive ops: each leg re-quotes live pool state. If slip is high, shrink or
 * stop remaining buys so you can edit BUY_BATCHES / MAX_BUYS and continue.
 *
 * Run:
 *   DRY_RUN=1 npx hardhat run scripts/ops-multi-wallet-market-buy.ts --network robinhood
 *   BUYER_START=6 BUYER_COUNT=5 MAX_BUYS=1 npx hardhat run scripts/ops-multi-wallet-market-buy.ts --network robinhood
 */
import { AbiCoder, Contract, Wallet, formatEther, formatUnits, parseEther, solidityPacked, ZeroAddress } from "ethers";
import { ethers, network } from "hardhat";
import { computePoolId } from "./lib/v4-math";
import { resolveHansomeAddress, resolveLpFee, resolveTickSpacing } from "./lib/pool-config";
import { parseEthAmountList, resolveBuyerIndices } from "./lib/buyer-indices";

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
  const buyerIndices = resolveBuyerIndices();
  const batches = parseEthAmountList(requireEnv("BUY_BATCHES"), buyerIndices.length, "BUY_BATCHES");
  const maxSlippageBps = process.env.MAX_SLIPPAGE_BPS ? Number(process.env.MAX_SLIPPAGE_BPS) : 200;
  const maxLegSlippageBps = process.env.MAX_LEG_SLIPPAGE_BPS
    ? Number(process.env.MAX_LEG_SLIPPAGE_BPS)
    : 2500;
  const autoShrinkLeg = process.env.AUTO_SHRINK_LEG !== "0";
  const fitToBalance = process.env.FIT_TO_BALANCE !== "0";
  const buyerGasCushion = parseEther(process.env.BUYER_ETH_GAS_CUSHION?.trim() || "0.005");
  const minBuyEth = parseEther(process.env.MIN_BUY_ETH?.trim() || "0.05");
  const maxBuys = process.env.MAX_BUYS ? Number(process.env.MAX_BUYS) : buyerIndices.length;
  const shuffle = process.env.SHUFFLE_BUYERS === "1"; // default OFF so fund amounts match buys
  const windowMs = process.env.BATCH_WINDOW_MS
    ? Number(process.env.BATCH_WINDOW_MS)
    : process.env.BATCH_DELAY_MS
      ? Number(process.env.BATCH_DELAY_MS)
      : 60_000;

  const buyers = buyerIndices.map((i) => walletFromEnv(`BUYER_${i}_PRIVATE_KEY`));
  const buyerAddrs = await Promise.all(buyers.map((b) => b.getAddress()));

  // Pair buyer i with batch i, then shuffle pairs so order + amount assignment look organic.
  const pairs = buyers.map((signer, i) => ({
    index: buyerIndices[i]!,
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

  const schedule = randomScheduleMs(windowMs, buyerIndices.length);
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

  const jobsToRun = jobs.slice(0, Math.max(1, Math.min(jobs.length, maxBuys)));

  console.log("Multi-wallet market buys (adaptive; re-quote each leg)");
  console.log(`  Network:  ${network.name} (${chainId})`);
  console.log(`  PoolId:   ${poolId}`);
  console.log(`  Total:    ${formatEther(totalEth)} ETH (planned)`);
  console.log(`  This run: ${jobsToRun.length} leg(s) (MAX_BUYS=${maxBuys})`);
  console.log(`  Shuffle:  ${shuffle}`);
  console.log(`  Window:   ${windowMs}ms`);
  console.log(`  Leg slip: max ${maxLegSlippageBps} bps | autoShrink=${autoShrinkLeg}`);
  console.log(`  Mode:     ${isDryRun ? "DRY_RUN" : "LIVE"}`);
  console.log("");
  console.log("Schedule (this run):");
  for (const j of jobsToRun) {
    console.log(`  t+${(j.atMs / 1000).toFixed(1)}s  Buyer ${j.index} ${j.address}  ${formatEther(j.ethIn)} ETH`);
  }
  console.log("");

  const started = Date.now();
  let stoppedEarly = false;

  for (let i = 0; i < jobsToRun.length; i++) {
    const job = jobsToRun[i]!;
    const waitUntil = started + job.atMs;
    const waitMs = waitUntil - Date.now();
    if (!isDryRun && waitMs > 0) {
      console.log(`waiting ${(waitMs / 1000).toFixed(1)}s until Buyer ${job.index}...`);
      await sleep(waitMs);
    }

    let ethIn = job.ethIn;
    const ethBal = await ethers.provider.getBalance(job.address);
    console.log(
      `--- t+${((Date.now() - started) / 1000).toFixed(1)}s Buyer ${job.index}: ${job.address} | plan ${formatEther(job.ethIn)} ETH (bal ${formatEther(ethBal)}) ---`,
    );

    if (fitToBalance) {
      const affordable = ethBal > buyerGasCushion ? ethBal - buyerGasCushion : 0n;
      if (affordable < minBuyEth) {
        console.log(
          `  SKIP: balance ${formatEther(ethBal)} below min buy + cushion (already spent or underfunded)`,
        );
        continue;
      }
      if (ethIn > affordable) {
        console.log(
          `  FIT_TO_BALANCE: ${formatEther(ethIn)} → ${formatEther(affordable)} ETH`,
        );
        ethIn = affordable;
      }
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
    const spotTokenPerEthNum = Number(slot0.sqrtPriceX96) / Number(2n ** 96n);
    const spotTokenPerEth = spotTokenPerEthNum * spotTokenPerEthNum;

    const quoteLeg = (amountIn: bigint) => {
      const ethInAfterFee = JSBI.divide(
        JSBI.multiply(JSBI.BigInt(amountIn.toString()), JSBI.BigInt(1_000_000 - lpFee)),
        JSBI.BigInt(1_000_000),
      );
      const sqrtNext = SqrtPriceMath.getNextSqrtPriceFromInput(
        sqrtCurrent,
        liquidityJ,
        ethInAfterFee,
        true,
      );
      const expectedOut = BigInt(
        SqrtPriceMath.getAmount1Delta(sqrtNext, sqrtCurrent, liquidityJ, false).toString(),
      );
      const spotOut = Number(formatEther(amountIn)) * spotTokenPerEth;
      const actualOut = Number(formatUnits(expectedOut, decimals));
      const slipBps =
        spotOut > 0 ? Math.round((1 - actualOut / spotOut) * 10_000) : 0;
      return { sqrtNext, expectedOut, slipBps };
    };

    let quote = quoteLeg(ethIn);
    while (quote.slipBps > maxLegSlippageBps && ethIn > minBuyEth) {
      if (!autoShrinkLeg) break;
      const next = (ethIn * 7n) / 10n;
      if (next < minBuyEth) break;
      console.log(
        `  slip ${quote.slipBps} bps > ${maxLegSlippageBps} — shrink ${formatEther(ethIn)} → ${formatEther(next)} ETH`,
      );
      ethIn = next;
      quote = quoteLeg(ethIn);
    }

    if (quote.slipBps > maxLegSlippageBps) {
      console.log(
        `  STOP: leg slip ${quote.slipBps} bps still > ${maxLegSlippageBps}. ` +
          `Edit BUY_BATCHES / MAX_BUYS and re-run for remaining buyers.`,
      );
      stoppedEarly = true;
      break;
    }

    if (!isDryRun && ethBal < ethIn) {
      throw new Error(
        `Buyer ${job.index} insufficient ETH: have ${formatEther(ethBal)}, need ${formatEther(ethIn)} + gas`,
      );
    }

    // Single-tick quotes can overestimate once price has moved — keep a wide floor.
    const minOutBps = Math.min(
      9_500,
      Math.max(maxSlippageBps, quote.slipBps * 2 + maxSlippageBps, 3_000),
    );
    let amountOutMin = (quote.expectedOut * BigInt(10_000 - minOutBps)) / 10_000n;
    console.log(`  tick ${slot0.tick} → ~${TickMath.getTickAtSqrtRatio(quote.sqrtNext)}`);
    console.log(`  use ${formatEther(ethIn)} ETH | est slip ${quote.slipBps} bps | minOut cushion ${minOutBps} bps`);
    console.log(`  expected ~${formatUnits(quote.expectedOut, decimals)} HANSOME`);

    const ur = new Contract(
      ADDR.universalRouter,
      ["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"],
      job.signer,
    );
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const commands = solidityPacked(["uint8"], [0x10]);

    const tryCall = async (minOut: bigint) => {
      const swapInput = buildEthToHansomeInput(poolKey, hansomeAddress, ethIn, minOut);
      if (isDryRun) {
        if (ethBal >= ethIn) {
          await ur.execute.staticCall(commands, [swapInput], deadline, { value: ethIn });
          console.log("  staticCall: PASSED");
        } else {
          console.log("  SKIP staticCall (buyer needs ETH) — fund before live run");
        }
        return null;
      }
      await ur.execute.staticCall(commands, [swapInput], deadline, { value: ethIn });
      const tx = await ur.execute(commands, [swapInput], deadline, { value: ethIn });
      return tx.wait();
    };

    try {
      if (isDryRun) {
        await tryCall(amountOutMin);
      } else {
        let receipt;
        try {
          receipt = await tryCall(amountOutMin);
        } catch (e1) {
          // Retry once with looser minOut (multi-tick / quote drift).
          amountOutMin = quote.expectedOut / 2n;
          console.log(`  staticCall/send failed — retry minOut=50% expected`);
          receipt = await tryCall(amountOutMin);
        }
        if (!receipt) throw new Error("No receipt");
        const hansomeAfter: bigint = await hansomeToken.balanceOf(job.address);
        console.log(`  tx: ${receipt.hash}`);
        console.log(`  received: ${formatUnits(hansomeAfter - hansomeBefore, decimals)}`);
        console.log(`  https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAILED: ${msg.split("\n")[0]}`);
      console.log("  Continuing remaining buyers…");
      continue;
    }
  }

  console.log("");
  if (stoppedEarly) {
    console.log(
      isDryRun
        ? "DRY_RUN stopped early on slip gate — adjust batches before live."
        : "Stopped early on slip gate — remaining buyers not submitted.",
    );
  } else {
    console.log(isDryRun ? "DRY_RUN complete." : `Submitted ${jobsToRun.length} buy(s).`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
