/**
 * A plain ETH -> HANSOME market buy from an independent personal/external
 * wallet — NOT the project Treasury. Executes the exact same Universal
 * Router swap path the website's swap UI uses (lib/swap/encoding.ts's
 * ETH->HANSOME command sequence), so on-chain this is indistinguishable
 * from any other user's organic buy.
 *
 * Deliberately does not touch TREASURY_PRIVATE_KEY / DEPLOYER_PRIVATE_KEY —
 * see getExternalBuyerSigner in lib/signer.ts. Configure the wallet's key
 * in EXTERNAL_BUYER_PRIVATE_KEY (contracts/.env, gitignored, never commit).
 *
 * Equivalent (and simpler / safer, no key handling at all) to just doing
 * this swap manually through https://www.hansomealpacas.xyz/swap while
 * connected with the personal wallet in MetaMask/Rabby/etc.
 *
 * Required env (contracts/.env or inline):
 *   EXTERNAL_BUYER_PRIVATE_KEY=0x...   (a personal wallet, funded with ETH — never Treasury)
 *   BUY_ETH_AMOUNT=0.28
 *   MAX_SLIPPAGE_BPS=150               (optional, default 150 = 1.5%)
 *
 * Run:
 *   BUY_ETH_AMOUNT=0.28 DRY_RUN=1 npx hardhat run scripts/market-buy-external.ts --network robinhood
 *   (drop DRY_RUN=1 to send the real swap transaction)
 */
import { AbiCoder, Contract, formatEther, formatUnits, parseEther, solidityPacked, ZeroAddress } from "ethers";
import { ethers, network } from "hardhat";
import { computePoolId } from "./lib/v4-math";
import { getExternalBuyerSigner } from "./lib/signer";
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

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected Robinhood Mainnet (${ROBINHOOD_CHAIN_ID}), got ${chainId}`);
  }

  const signer = await getExternalBuyerSigner(ethers.provider);
  const buyer = await signer.getAddress();

  const ethIn = parseEther(requireEnv("BUY_ETH_AMOUNT"));
  const maxSlippageBps = process.env.MAX_SLIPPAGE_BPS ? Number(process.env.MAX_SLIPPAGE_BPS) : 150;

  const hansomeAddress = resolveHansomeAddress();
  const lpFee = resolveLpFee();
  const tickSpacing = resolveTickSpacing();
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

  console.log("External personal-wallet market buy (Treasury NOT involved)");
  console.log(`  Network:   ${network.name} (${chainId})`);
  console.log(`  Buyer:     ${buyer}`);
  console.log(`  ETH in:    ${formatEther(ethIn)}`);

  const [slot0, poolLiquidity, ethBalance, hansomeBefore, decimals] = await Promise.all([
    stateView.getSlot0(poolId),
    stateView.getLiquidity(poolId),
    ethers.provider.getBalance(buyer),
    hansomeToken.balanceOf(buyer),
    hansomeToken.decimals(),
  ]);

  if (slot0.sqrtPriceX96 === 0n || poolLiquidity === 0n) {
    throw new Error("Pool not initialized or has zero active liquidity");
  }
  if (ethBalance < ethIn) {
    throw new Error(`Insufficient buyer ETH: have ${formatEther(ethBalance)}, need ${formatEther(ethIn)} (fund EXTERNAL_BUYER_PRIVATE_KEY's wallet first, not Treasury)`);
  }

  const sqrtCurrent = JSBI.BigInt(slot0.sqrtPriceX96.toString());
  const liquidityJ = JSBI.BigInt(poolLiquidity.toString());
  const ethInAfterFee = JSBI.divide(JSBI.multiply(JSBI.BigInt(ethIn.toString()), JSBI.BigInt(1_000_000 - lpFee)), JSBI.BigInt(1_000_000));
  const sqrtNext = SqrtPriceMath.getNextSqrtPriceFromInput(sqrtCurrent, liquidityJ, ethInAfterFee, true);
  const expectedHansomeOut = BigInt(SqrtPriceMath.getAmount1Delta(sqrtNext, sqrtCurrent, liquidityJ, false).toString());
  const tickNext = Number(TickMath.getTickAtSqrtRatio(sqrtNext).toString());
  const amountOutMin = (expectedHansomeOut * BigInt(10_000 - maxSlippageBps)) / 10_000n;

  console.log("");
  console.log("Pre-flight simulation");
  console.log(`  Current tick:        ${slot0.tick.toString()}`);
  console.log(`  Expected new tick:   ${tickNext}`);
  console.log(`  Expected HANSOME out: ${formatUnits(expectedHansomeOut, decimals)}`);
  console.log(`  amountOutMin (${maxSlippageBps / 100}% max slippage): ${formatUnits(amountOutMin, decimals)}`);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const swapInput = buildEthToHansomeInput(poolKey, hansomeAddress, ethIn, amountOutMin);
  const commands = solidityPacked(["uint8"], [0x10]);
  const ur = new Contract(ADDR.universalRouter, ["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"], signer);

  if (process.env.DRY_RUN === "1") {
    console.log("");
    console.log("DRY_RUN=1 — simulating swap only (no transaction sent, no ETH spent)");
    await ur.execute.staticCall(commands, [swapInput], deadline, { value: ethIn });
    console.log("  staticCall: PASSED");
    console.log("  DRY_RUN: ALL CHECKS PASSED — no swap executed");
    return;
  }

  console.log("");
  console.log(`Submitting Universal Router swap: ${formatEther(ethIn)} ETH -> HANSOME (min ${formatUnits(amountOutMin, decimals)})...`);

  const tx = await ur.execute(commands, [swapInput], deadline, { value: ethIn });
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction failed — no receipt returned");
  }

  const hansomeAfter: bigint = await hansomeToken.balanceOf(buyer);
  const actualReceived = hansomeAfter - hansomeBefore;

  console.log("");
  console.log("Buy executed");
  console.log(`  Transaction Hash:  ${receipt.hash}`);
  console.log(`  Block Number:      ${receipt.blockNumber}`);
  console.log(`  HANSOME received:  ${formatUnits(actualReceived, decimals)}`);
  console.log(`  Buyer HANSOME now: ${formatUnits(hansomeAfter, decimals)}`);
  console.log(`  Explorer:          https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
