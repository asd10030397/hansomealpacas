/**
 * Mint a matched Uniswap v4 LP on the live HANSOME/ETH pool using the
 * Liquidity wallet's current balances (ETH-limited at typical prices).
 *
 * Optionally tops up Liquidity from FUNDING_PRIVATE_KEY first.
 *
 * Env:
 *   MINT_TICK_LOWER=160000
 *   MINT_TICK_UPPER=240000
 *   GAS_RESERVE_ETH=0.012
 *   FUND_EXTRA_ETH=0.186          (optional — pull from funding → liquidity)
 *   DRY_RUN=1
 *
 * Run:
 *   DRY_RUN=1 npx hardhat run scripts/ops-mint-matched-lp-now.ts --network robinhood
 *   npx hardhat run scripts/ops-mint-matched-lp-now.ts --network robinhood
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
import {
  computePoolId,
  getLiquidityForAmounts,
  getSqrtPriceAtTick,
  truncateTickSpacing,
} from "./lib/v4-math";
import { getLiquidityWalletSigner } from "./lib/signer";
import { resolveHansomeAddress, resolveLpFee, resolveTickSpacing } from "./lib/pool-config";

const ROBINHOOD_CHAIN_ID = 4663;

const UNISWAP_V4 = {
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
} as const;

const ACTIONS = {
  MINT_POSITION: 0x02,
  SETTLE_PAIR: 0x0d,
  SWEEP: 0x14,
} as const;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SqrtPriceMath, TickMath } = require("@uniswap/v3-sdk") as typeof import("@uniswap/v3-sdk");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSBI = require("jsbi").default ?? require("jsbi");

function requireEnvInt(name: string, fallback: string): number {
  return Number((process.env[name]?.trim() || fallback));
}

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

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected ${ROBINHOOD_CHAIN_ID}, got ${chainId}`);
  }

  const isDryRun = process.env.DRY_RUN === "1";
  const tickSpacing = resolveTickSpacing();
  const tickLower = truncateTickSpacing(requireEnvInt("MINT_TICK_LOWER", "160000"), tickSpacing);
  const tickUpper = truncateTickSpacing(requireEnvInt("MINT_TICK_UPPER", "240000"), tickSpacing);
  if (tickLower >= tickUpper) throw new Error("tickLower >= tickUpper");

  const signer = await getLiquidityWalletSigner(ethers.provider);
  const recipient = await signer.getAddress();
  const hansomeAddress = resolveHansomeAddress();
  const lpFee = resolveLpFee();
  const poolKey = {
    currency0: ZeroAddress,
    currency1: hansomeAddress,
    fee: lpFee,
    tickSpacing,
    hooks: ZeroAddress,
  };
  const poolId = computePoolId(poolKey);

  const fundExtraRaw = process.env.FUND_EXTRA_ETH?.trim();
  let fundedExtra = 0n;
  if (fundExtraRaw) {
    fundedExtra = parseEther(fundExtraRaw);
    const funding = walletFromEnv("FUNDING_PRIVATE_KEY");
    const fundingAddr = await funding.getAddress();
    const expected = process.env.FUNDING_EXPECTED_ADDRESS?.trim();
    if (expected && fundingAddr.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`FUNDING_PRIVATE_KEY does not match FUNDING_EXPECTED_ADDRESS`);
    }
    console.log(`Top-up: ${formatEther(fundedExtra)} ETH from funding ${fundingAddr} → ${recipient}`);
    if (!isDryRun) {
      const tx = await funding.sendTransaction({ to: recipient, value: fundedExtra });
      console.log(`  top-up tx: ${tx.hash}`);
      await tx.wait();
    } else {
      console.log("  DRY_RUN — top-up not sent (included in balance math below)");
    }
  }

  const stateView = new Contract(
    UNISWAP_V4.stateView,
    ["function getSlot0(bytes32) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"],
    ethers.provider,
  );
  const hansomeToken = new Contract(
    hansomeAddress,
    [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
      "function approve(address,uint256) returns (bool)",
      "function allowance(address,address) view returns (uint256)",
    ],
    signer,
  );
  const permit2 = new Contract(
    UNISWAP_V4.permit2,
    [
      "function approve(address token, address spender, uint160 amount, uint48 expiration)",
      "function allowance(address owner, address token, address spender) view returns (uint160,uint48,uint48)",
    ],
    signer,
  );
  const positionManager = new Contract(
    UNISWAP_V4.positionManager,
    [
      "function modifyLiquidities(bytes unlockData, uint256 deadline) payable",
      "function nextTokenId() view returns (uint256)",
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    ],
    signer,
  );

  const gasReserve = parseEther(process.env.GAS_RESERVE_ETH ?? "0.012");
  const [slot0, ethBalanceRaw, hansomeBalance, decimals, symbol] = await Promise.all([
    stateView.getSlot0(poolId),
    ethers.provider.getBalance(recipient),
    hansomeToken.balanceOf(recipient) as Promise<bigint>,
    hansomeToken.decimals() as Promise<number>,
    hansomeToken.symbol() as Promise<string>,
  ]);
  // In DRY_RUN, pretend the optional funding top-up already landed.
  const ethBalance = isDryRun && fundedExtra > 0n ? ethBalanceRaw + fundedExtra : ethBalanceRaw;

  if (slot0.sqrtPriceX96 === 0n) throw new Error("Pool not initialized");
  const currentTick = Number(slot0.tick);
  const inRange = currentTick >= tickLower && currentTick < tickUpper;
  if (!inRange) {
    throw new Error(
      `Current tick ${currentTick} is outside [${tickLower}, ${tickUpper}] — refuse one-sided mint; pick a range that contains the live tick`,
    );
  }
  if (ethBalance <= gasReserve) {
    throw new Error(`Liquidity ETH ${formatEther(ethBalance)} <= gas reserve ${formatEther(gasReserve)}`);
  }

  const ethAmount = ethBalance - gasReserve;
  const sqrtLower = getSqrtPriceAtTick(tickLower);
  const sqrtUpper = getSqrtPriceAtTick(tickUpper);
  const liquidity = getLiquidityForAmounts(
    slot0.sqrtPriceX96,
    sqrtLower,
    sqrtUpper,
    ethAmount,
    hansomeBalance,
  );
  if (liquidity === 0n) throw new Error("Computed liquidity is zero");

  const Lb = JSBI.BigInt(liquidity.toString());
  const sP = JSBI.BigInt(slot0.sqrtPriceX96.toString());
  const sA = TickMath.getSqrtRatioAtTick(tickLower);
  const sB = TickMath.getSqrtRatioAtTick(tickUpper);
  const ethNeeded = BigInt(SqrtPriceMath.getAmount0Delta(sP, sB, Lb, true).toString());
  const hansomeNeeded = BigInt(SqrtPriceMath.getAmount1Delta(sA, sP, Lb, true).toString());

  console.log("");
  console.log("Matched LP mint (live balances)");
  console.log(`  Network:        ${network.name} (${chainId})`);
  console.log(`  Liquidity:      ${recipient}`);
  console.log(`  PoolId:         ${poolId}`);
  console.log(`  Live tick:      ${currentTick} (in-range: ${inRange})`);
  console.log(`  Range:          [${tickLower}, ${tickUpper}]`);
  console.log(`  ETH balance:    ${formatEther(ethBalance)} (reserve ${formatEther(gasReserve)})`);
  console.log(`  HANSOME bal:    ${formatUnits(hansomeBalance, decimals)} ${symbol}`);
  console.log(`  Will use ETH:   ${formatEther(ethNeeded)}`);
  console.log(`  Will use HANSOME: ${formatUnits(hansomeNeeded, decimals)}`);
  console.log(`  Liquidity L:    ${liquidity.toString()}`);
  console.log(`  DRY_RUN:        ${isDryRun ? "yes" : "NO — live mint"}`);

  if (ethNeeded > ethAmount + 1n) {
    throw new Error(`ETH needed ${formatEther(ethNeeded)} > usable ${formatEther(ethAmount)}`);
  }
  if (hansomeNeeded > hansomeBalance) {
    throw new Error(`HANSOME needed ${formatUnits(hansomeNeeded, decimals)} > balance`);
  }

  const amount0Max = ethNeeded + 1n;
  const amount1Max = hansomeNeeded + 1n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const poolKeyTuple = [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks];
  const actions = solidityPacked(
    ["uint8", "uint8", "uint8", "uint8"],
    [ACTIONS.MINT_POSITION, ACTIONS.SETTLE_PAIR, ACTIONS.SWEEP, ACTIONS.SWEEP],
  );
  const params = [
    AbiCoder.defaultAbiCoder().encode(
      ["tuple(address,address,uint24,int24,address)", "int24", "int24", "uint256", "uint128", "uint128", "address", "bytes"],
      [poolKeyTuple, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency0, poolKey.currency1]),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency0, recipient]),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency1, recipient]),
  ];
  const unlockData = AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);

  if (isDryRun) {
    const erc20Allowance: bigint = await hansomeToken.allowance(recipient, UNISWAP_V4.permit2);
    const permit2Allowance = await permit2.allowance(recipient, hansomeAddress, UNISWAP_V4.positionManager);
    const nowSec = Math.floor(Date.now() / 1000);
    const permitOk =
      BigInt(permit2Allowance[0]) >= hansomeNeeded && Number(permit2Allowance[1]) > nowSec;
    if (erc20Allowance >= hansomeNeeded && permitOk) {
      await positionManager.modifyLiquidities.staticCall(unlockData, deadline, { value: amount0Max });
      console.log("  staticCall: PASS");
    } else {
      console.log("  staticCall: SKIPPED (allowances will be set on live run)");
    }
    console.log("DRY_RUN complete — no mint sent");
    return;
  }

  const erc20Allowance: bigint = await hansomeToken.allowance(recipient, UNISWAP_V4.permit2);
  if (erc20Allowance < hansomeNeeded) {
    console.log("Approving HANSOME → Permit2...");
    await (await hansomeToken.approve(UNISWAP_V4.permit2, MaxUint256)).wait();
  }
  const permit2Allowance = await permit2.allowance(recipient, hansomeAddress, UNISWAP_V4.positionManager);
  const nowSec = Math.floor(Date.now() / 1000);
  if (BigInt(permit2Allowance[0]) < hansomeNeeded || Number(permit2Allowance[1]) <= nowSec) {
    console.log("Approving Permit2 → PositionManager...");
    const expiration = nowSec + 86_400;
    await (await permit2.approve(hansomeAddress, UNISWAP_V4.positionManager, 2n ** 160n - 1n, expiration)).wait();
  }

  const positionIdBefore: bigint = await positionManager.nextTokenId();
  const ethBefore = await ethers.provider.getBalance(recipient);
  const hansomeBefore: bigint = await hansomeToken.balanceOf(recipient);

  console.log("Submitting MINT_POSITION...");
  const tx = await positionManager.modifyLiquidities(unlockData, deadline, { value: amount0Max });
  const receipt = await tx.wait();
  if (!receipt) throw new Error("No receipt");

  let positionId = positionIdBefore;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== UNISWAP_V4.positionManager.toLowerCase()) continue;
    try {
      const parsed = positionManager.interface.parseLog(log);
      if (parsed?.name === "Transfer" && parsed.args.from === ZeroAddress) {
        positionId = parsed.args.tokenId;
      }
    } catch {
      // ignore
    }
  }

  const owner = await positionManager.ownerOf(positionId);
  if (owner.toLowerCase() !== recipient.toLowerCase()) {
    throw new Error(`Position owner mismatch: ${owner}`);
  }
  const positionLiquidity: bigint = await positionManager.getPositionLiquidity(positionId);
  if (positionLiquidity === 0n) throw new Error("Minted position has zero liquidity");

  const ethAfter = await ethers.provider.getBalance(recipient);
  const hansomeAfter: bigint = await hansomeToken.balanceOf(recipient);
  const slot0After = await stateView.getSlot0(poolId);

  console.log("");
  console.log("Minted");
  console.log(`  tx:           ${receipt.hash}`);
  console.log(`  positionId:   ${positionId.toString()}`);
  console.log(`  liquidity:    ${positionLiquidity.toString()}`);
  console.log(`  ETH spent:    ${formatEther(ethBefore - ethAfter)} (incl. gas)`);
  console.log(`  HANSOME used: ${formatUnits(hansomeBefore - hansomeAfter, decimals)}`);
  console.log(`  tick after:   ${slot0After.tick.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
