/**
 * Sell HANSOME → ETH from a seller wallet, then send ETH to FUNDING so
 * funding balance ≈ TARGET_FUNDING_USD (default $350).
 *
 * Env:
 *   SELLER_PRIVATE_KEY          (default: BUYER_1_PRIVATE_KEY)
 *   FUNDING_EXPECTED_ADDRESS    (default: 0x74705c97…07aD)
 *   TARGET_FUNDING_USD=350
 *   ETH_USD_PRICE=1940          (manual; used only for USD↔ETH sizing)
 *   MAX_SLIPPAGE_BPS=300
 *   SELLER_ETH_GAS_CUSHION=0.002
 *   DRY_RUN=1
 *
 * Run:
 *   DRY_RUN=1 npx hardhat run scripts/ops-market-sell-to-funding.ts --network robinhood
 *   npx hardhat run scripts/ops-market-sell-to-funding.ts --network robinhood
 */
import {
  AbiCoder,
  Contract,
  MaxUint256,
  Wallet,
  ZeroAddress,
  formatEther,
  formatUnits,
  parseEther,
  solidityPacked,
} from "ethers";
import { ethers, network } from "hardhat";
import { computePoolId } from "./lib/v4-math";
import { resolveHansomeAddress, resolveLpFee, resolveTickSpacing } from "./lib/pool-config";

const ROBINHOOD_CHAIN_ID = 4663;
const DEFAULT_FUNDING = "0x74705c97E16205E6336370a6e5e06984288907aD";

const ADDR = {
  universalRouter: "0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SqrtPriceMath } = require("@uniswap/v3-sdk") as typeof import("@uniswap/v3-sdk");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSBI = require("jsbi").default ?? require("jsbi");

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

function buildHansomeToEthInput(
  poolKey: readonly unknown[],
  hansomeAddress: string,
  amountIn: bigint,
  amountOutMin: bigint,
) {
  const actions = solidityPacked(["uint8", "uint8", "uint8"], [0x06, 0x0b, 0x0f]);
  const params = [
    AbiCoder.defaultAbiCoder().encode(
      ["tuple(address,address,uint24,int24,address)", "bool", "uint128", "uint128", "uint256", "bytes"],
      [poolKey, false, amountIn, amountOutMin, 0n, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256", "bool"], [hansomeAddress, amountIn, true]),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [ZeroAddress, amountOutMin]),
  ];
  return AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
}

function quoteEthOut(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  lpFee: number,
  hansomeIn: bigint,
): bigint {
  const sqrt = JSBI.BigInt(sqrtPriceX96.toString());
  const L = JSBI.BigInt(liquidity.toString());
  const inAfterFee = JSBI.divide(
    JSBI.multiply(JSBI.BigInt(hansomeIn.toString()), JSBI.BigInt(1_000_000 - lpFee)),
    JSBI.BigInt(1_000_000),
  );
  const sqrtNext = SqrtPriceMath.getNextSqrtPriceFromInput(sqrt, L, inAfterFee, false);
  return BigInt(SqrtPriceMath.getAmount0Delta(sqrt, sqrtNext, L, false).toString());
}

/** Binary-search HANSOME in to hit target ETH out (approx). */
function sizeHansomeForEthOut(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  lpFee: number,
  targetEthOut: bigint,
  maxHansome: bigint,
): { hansomeIn: bigint; ethOut: bigint } {
  let lo = 1n;
  let hi = maxHansome;
  let bestIn = 0n;
  let bestOut = 0n;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2n;
    if (mid === 0n) break;
    const out = quoteEthOut(sqrtPriceX96, liquidity, lpFee, mid);
    if (out >= targetEthOut) {
      bestIn = mid;
      bestOut = out;
      hi = mid - 1n;
    } else {
      lo = mid + 1n;
    }
  }
  if (bestIn === 0n) {
    // Even max balance cannot reach target — sell all
    const out = quoteEthOut(sqrtPriceX96, liquidity, lpFee, maxHansome);
    return { hansomeIn: maxHansome, ethOut: out };
  }
  return { hansomeIn: bestIn, ethOut: bestOut };
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected ${ROBINHOOD_CHAIN_ID}, got ${chainId}`);
  }

  const isDryRun = process.env.DRY_RUN === "1";
  const sellerKeyEnv = process.env.SELLER_PRIVATE_KEY?.trim()
    ? "SELLER_PRIVATE_KEY"
    : "BUYER_1_PRIVATE_KEY";
  const seller = walletFromEnv(sellerKeyEnv);
  const sellerAddr = await seller.getAddress();

  const fundingAddr = ethers.getAddress(
    process.env.FUNDING_EXPECTED_ADDRESS?.trim() || DEFAULT_FUNDING,
  );
  const targetUsd = Number(process.env.TARGET_FUNDING_USD?.trim() || "350");
  const ethUsd = Number(process.env.ETH_USD_PRICE?.trim() || "1940");
  if (!(targetUsd > 0) || !(ethUsd > 0)) {
    throw new Error("TARGET_FUNDING_USD and ETH_USD_PRICE must be positive");
  }
  const targetEth = parseEther((targetUsd / ethUsd).toFixed(8));
  const maxSlippageBps = process.env.MAX_SLIPPAGE_BPS
    ? Number(process.env.MAX_SLIPPAGE_BPS)
    : 300;
  const sellerCushion = parseEther(process.env.SELLER_ETH_GAS_CUSHION?.trim() || "0.002");

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

  const hansome = new Contract(
    hansomeAddress,
    [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function allowance(address,address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)",
    ],
    seller,
  );
  const stateView = new Contract(
    ADDR.stateView,
    [
      "function getSlot0(bytes32) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
      "function getLiquidity(bytes32) view returns (uint128)",
    ],
    ethers.provider,
  );
  const permit2 = new Contract(
    ADDR.permit2,
    [
      "function allowance(address,address,address) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
      "function approve(address token, address spender, uint160 amount, uint48 expiration)",
    ],
    seller,
  );

  const [slot0, poolLiquidity, sellerEth, sellerHansome, fundingEth, decimals] = await Promise.all([
    stateView.getSlot0(poolId),
    stateView.getLiquidity(poolId),
    ethers.provider.getBalance(sellerAddr),
    hansome.balanceOf(sellerAddr) as Promise<bigint>,
    ethers.provider.getBalance(fundingAddr),
    hansome.decimals() as Promise<number>,
  ]);

  if (slot0.sqrtPriceX96 === 0n || poolLiquidity === 0n) {
    throw new Error("Pool not ready");
  }
  if (sellerHansome === 0n) {
    throw new Error(`Seller ${sellerAddr} has 0 HANSOME`);
  }

  const ethNeeded =
    fundingEth >= targetEth ? 0n : targetEth - fundingEth;
  if (ethNeeded === 0n) {
    console.log(`Funding already ≥ target (${formatEther(fundingEth)} ETH). Nothing to sell.`);
    return;
  }

  // Oversize slightly for fees/slippage buffer (~2%)
  const ethTargetWithBuffer = (ethNeeded * 102n) / 100n;
  const sized = sizeHansomeForEthOut(
    slot0.sqrtPriceX96,
    poolLiquidity,
    lpFee,
    ethTargetWithBuffer,
    sellerHansome,
  );
  const hansomeIn = sized.hansomeIn;
  const expectedEthOut = sized.ethOut;
  const amountOutMin = (expectedEthOut * BigInt(10_000 - maxSlippageBps)) / 10_000n;

  console.log("Market sell HANSOME → ETH → FUNDING");
  console.log(`  Network:   ${network.name} (${chainId})`);
  console.log(`  Seller:    ${sellerAddr} (${sellerKeyEnv})`);
  console.log(`  Funding:   ${fundingAddr}`);
  console.log(`  Mode:      ${isDryRun ? "DRY_RUN" : "LIVE"}`);
  console.log("");
  console.log("Balances before");
  console.log(`  Seller ETH:     ${formatEther(sellerEth)}`);
  console.log(`  Seller HANSOME: ${formatUnits(sellerHansome, decimals)}`);
  console.log(`  Funding ETH:    ${formatEther(fundingEth)} (~$${(Number(formatEther(fundingEth)) * ethUsd).toFixed(2)})`);
  console.log("");
  console.log("Target");
  console.log(`  Funding ≈ $${targetUsd} @ $${ethUsd}/ETH → ${formatEther(targetEth)} ETH`);
  console.log(`  ETH needed:     ${formatEther(ethNeeded)}`);
  console.log(`  Sell HANSOME:   ${formatUnits(hansomeIn, decimals)}`);
  console.log(`  Est ETH out:    ${formatEther(expectedEthOut)}`);
  console.log(`  minOut:         ${formatEther(amountOutMin)} (${maxSlippageBps} bps)`);

  if (sellerEth < sellerCushion) {
    console.log(
      `WARNING: seller ETH ${formatEther(sellerEth)} < cushion ${formatEther(sellerCushion)} — may fail on gas`,
    );
  }

  const ur = new Contract(
    ADDR.universalRouter,
    ["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"],
    seller,
  );
  const commands = solidityPacked(["uint8"], [0x10]);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const swapInput = buildHansomeToEthInput(poolKey, hansomeAddress, hansomeIn, amountOutMin);

  if (isDryRun) {
    const erc20Allowance: bigint = await hansome.allowance(sellerAddr, ADDR.permit2);
    const p2 = await permit2.allowance(sellerAddr, hansomeAddress, ADDR.universalRouter);
    console.log("");
    console.log("Approvals");
    console.log(`  ERC20→Permit2: ${erc20Allowance >= hansomeIn ? "OK" : "NEED approve"}`);
    console.log(
      `  Permit2→UR:    ${BigInt(p2[0]) >= hansomeIn && Number(p2[1]) > Math.floor(Date.now() / 1000) ? "OK" : "NEED permit2.approve"}`,
    );
    try {
      await ur.execute.staticCall(commands, [swapInput], deadline);
      console.log("  staticCall: PASS");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  staticCall: FAIL (likely needs approvals first) — ${msg.split("\n")[0]}`);
    }
    console.log("");
    console.log("DRY_RUN — no txs sent.");
    return;
  }

  // Approvals
  const erc20Allowance: bigint = await hansome.allowance(sellerAddr, ADDR.permit2);
  if (erc20Allowance < hansomeIn) {
    console.log("Approve HANSOME → Permit2...");
    const tx = await hansome.approve(ADDR.permit2, MaxUint256);
    await tx.wait();
    console.log(`  ${tx.hash}`);
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const p2 = await permit2.allowance(sellerAddr, hansomeAddress, ADDR.universalRouter);
  if (BigInt(p2[0]) < hansomeIn || Number(p2[1]) <= nowSec) {
    console.log("Permit2 approve → UniversalRouter...");
    const tx = await permit2.approve(
      hansomeAddress,
      ADDR.universalRouter,
      2n ** 160n - 1n,
      nowSec + 86_400,
    );
    await tx.wait();
    console.log(`  ${tx.hash}`);
  }

  console.log("Swap HANSOME → ETH...");
  await ur.execute.staticCall(commands, [swapInput], deadline);
  const swapTx = await ur.execute(commands, [swapInput], deadline);
  const receipt = await swapTx.wait();
  console.log(`  ${receipt?.hash ?? swapTx.hash}`);
  console.log(`  https://robinhoodchain.blockscout.com/tx/${receipt?.hash ?? swapTx.hash}`);

  const sellerEthAfter = await ethers.provider.getBalance(sellerAddr);
  const sendable = sellerEthAfter > sellerCushion ? sellerEthAfter - sellerCushion : 0n;
  if (sendable === 0n) {
    throw new Error(
      `After swap, seller ETH ${formatEther(sellerEthAfter)} ≤ cushion — cannot fund`,
    );
  }

  console.log(`Send ${formatEther(sendable)} ETH → funding (leave ${formatEther(sellerCushion)})...`);
  const sendTx = await seller.sendTransaction({ to: fundingAddr, value: sendable });
  await sendTx.wait();
  console.log(`  ${sendTx.hash}`);

  const [fundingAfter, sellerHansomeAfter] = await Promise.all([
    ethers.provider.getBalance(fundingAddr),
    hansome.balanceOf(sellerAddr) as Promise<bigint>,
  ]);
  console.log("");
  console.log("Done");
  console.log(
    `  Funding ETH: ${formatEther(fundingAfter)} (~$${(Number(formatEther(fundingAfter)) * ethUsd).toFixed(2)})`,
  );
  console.log(`  Seller HANSOME left: ${formatUnits(sellerHansomeAfter, decimals)}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
