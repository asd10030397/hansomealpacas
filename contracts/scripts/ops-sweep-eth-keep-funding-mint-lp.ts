/**
 * 1) Sweep leftover ETH from Buyer 1..5 → funding
 * 2) Leave KEEP_FUNDING_ETH on funding (default 0.1) for the operator
 * 3) Send the rest funding → Liquidity
 * 4) Mint matched LP on [MINT_TICK_LOWER, MINT_TICK_UPPER]
 *
 * Env:
 *   KEEP_FUNDING_ETH=0.1
 *   BUYER_ETH_GAS_CUSHION=0.008
 *   GAS_RESERVE_ETH=0.012          (left on Liquidity after mint)
 *   MINT_TICK_LOWER=160000
 *   MINT_TICK_UPPER=240000
 *   DRY_RUN=1
 *
 * Requires: FUNDING_PRIVATE_KEY, LIQUIDITY_PRIVATE_KEY, BUYER_N_PRIVATE_KEY
 *   BUYER_START / BUYER_COUNT or BUYER_INDICES (default 1..5)
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
import { resolveBuyerIndices } from "./lib/buyer-indices";

const ROBINHOOD_CHAIN_ID = 4663;
const DEFAULT_FUNDING = "0x74705c97E16205E6336370a6e5e06984288907aD";
const DEFAULT_LIQUIDITY = "0x0bd54aeE53E9603375C27940d74e7c0923573b2a";

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
  const keepFunding = parseEther(process.env.KEEP_FUNDING_ETH ?? "0.1");
  const buyerCushion = parseEther(process.env.BUYER_ETH_GAS_CUSHION ?? "0.008");
  const liqGasReserve = parseEther(process.env.GAS_RESERVE_ETH ?? "0.012");
  const tickSpacing = resolveTickSpacing();
  const tickLower = truncateTickSpacing(Number(process.env.MINT_TICK_LOWER ?? "160000"), tickSpacing);
  const tickUpper = truncateTickSpacing(Number(process.env.MINT_TICK_UPPER ?? "240000"), tickSpacing);

  const funding = walletFromEnv("FUNDING_PRIVATE_KEY");
  const fundingAddr = await funding.getAddress();
  const expectedFunding = process.env.FUNDING_EXPECTED_ADDRESS?.trim() || DEFAULT_FUNDING;
  if (fundingAddr.toLowerCase() !== expectedFunding.toLowerCase()) {
    throw new Error(`FUNDING_PRIVATE_KEY derives ${fundingAddr}, expected ${expectedFunding}`);
  }

  const liqSigner = await getLiquidityWalletSigner(ethers.provider);
  const liqAddr = await liqSigner.getAddress();
  if (liqAddr.toLowerCase() !== DEFAULT_LIQUIDITY.toLowerCase()) {
    throw new Error(`Liquidity address mismatch: ${liqAddr}`);
  }

  console.log(`Network ${network.name} (${chainId}) DRY_RUN=${isDryRun ? "yes" : "NO"}`);
  console.log(`Keep on funding: ${formatEther(keepFunding)} ETH`);

  // --- 1) Sweep buyers → funding ---
  const buyerIndices = resolveBuyerIndices();
  let swept = 0n;
  for (const i of buyerIndices) {
    const buyer = walletFromEnv(`BUYER_${i}_PRIVATE_KEY`);
    const addr = await buyer.getAddress();
    const bal = await ethers.provider.getBalance(addr);
    if (bal <= buyerCushion) {
      console.log(`Buyer ${i} ${addr}: skip (bal ${formatEther(bal)} <= cushion)`);
      continue;
    }
    const send = bal - buyerCushion;
    console.log(`Buyer ${i} → funding: ${formatEther(send)} ETH`);
    if (!isDryRun) {
      const tx = await buyer.sendTransaction({ to: fundingAddr, value: send });
      console.log(`  tx ${tx.hash}`);
      await tx.wait();
    }
    swept += send;
  }
  console.log(`Swept (gross): ${formatEther(swept)} ETH`);

  // --- 2) funding keep 0.1, rest → liquidity ---
  const fundingBalRaw = await ethers.provider.getBalance(fundingAddr);
  const fundingBal = isDryRun ? fundingBalRaw + swept : fundingBalRaw;
  if (fundingBal < keepFunding) {
    throw new Error(
      `Funding would have ${formatEther(fundingBal)} < KEEP ${formatEther(keepFunding)} — abort`,
    );
  }
  // Leave keep + small gas for the forward tx itself
  const fundingTxGas = parseEther("0.001");
  const toLiq = fundingBal - keepFunding - (isDryRun ? 0n : fundingTxGas);
  if (toLiq <= 0n) {
    throw new Error(`Nothing to send to Liquidity after keep+gas (toLiq=${toLiq})`);
  }
  console.log(`Funding → Liquidity: ${formatEther(toLiq)} ETH (leave ${formatEther(keepFunding)} + gas)`);
  if (!isDryRun) {
    const tx = await funding.sendTransaction({ to: liqAddr, value: toLiq });
    console.log(`  tx ${tx.hash}`);
    await tx.wait();
  }

  // --- 3) Matched mint ---
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
    liqSigner,
  );
  const permit2 = new Contract(
    UNISWAP_V4.permit2,
    [
      "function approve(address token, address spender, uint160 amount, uint48 expiration)",
      "function allowance(address owner, address token, address spender) view returns (uint160,uint48,uint48)",
    ],
    liqSigner,
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
    liqSigner,
  );

  const [slot0, ethBalRaw, hansomeBalance, decimals] = await Promise.all([
    stateView.getSlot0(poolId),
    ethers.provider.getBalance(liqAddr),
    hansomeToken.balanceOf(liqAddr) as Promise<bigint>,
    hansomeToken.decimals() as Promise<number>,
  ]);
  const ethBalance = isDryRun ? ethBalRaw + toLiq : ethBalRaw;
  const currentTick = Number(slot0.tick);
  if (!(currentTick >= tickLower && currentTick < tickUpper)) {
    throw new Error(`Tick ${currentTick} outside [${tickLower},${tickUpper}]`);
  }
  if (ethBalance <= liqGasReserve) {
    throw new Error(`Liquidity ETH ${formatEther(ethBalance)} <= reserve ${formatEther(liqGasReserve)}`);
  }

  const ethAmount = ethBalance - liqGasReserve;
  const liquidity = getLiquidityForAmounts(
    slot0.sqrtPriceX96,
    getSqrtPriceAtTick(tickLower),
    getSqrtPriceAtTick(tickUpper),
    ethAmount,
    hansomeBalance,
  );
  if (liquidity === 0n) throw new Error("Computed liquidity is zero");

  const Lb = JSBI.BigInt(liquidity.toString());
  const sP = JSBI.BigInt(slot0.sqrtPriceX96.toString());
  const ethNeeded = BigInt(
    SqrtPriceMath.getAmount0Delta(sP, TickMath.getSqrtRatioAtTick(tickUpper), Lb, true).toString(),
  );
  const hansomeNeeded = BigInt(
    SqrtPriceMath.getAmount1Delta(TickMath.getSqrtRatioAtTick(tickLower), sP, Lb, true).toString(),
  );

  console.log("");
  console.log("Matched mint plan");
  console.log(`  tick ${currentTick} range [${tickLower},${tickUpper}]`);
  console.log(`  use ETH ${formatEther(ethNeeded)} / HANSOME ${formatUnits(hansomeNeeded, decimals)}`);
  console.log(`  L ${liquidity.toString()}`);

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
      [poolKeyTuple, tickLower, tickUpper, liquidity, amount0Max, amount1Max, liqAddr, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency0, poolKey.currency1]),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency0, liqAddr]),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency1, liqAddr]),
  ];
  const unlockData = AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);

  if (isDryRun) {
    console.log("DRY_RUN complete — no txs sent");
    console.log(`Would leave ~${formatEther(keepFunding)} ETH on funding ${fundingAddr}`);
    return;
  }

  const erc20Allowance: bigint = await hansomeToken.allowance(liqAddr, UNISWAP_V4.permit2);
  if (erc20Allowance < hansomeNeeded) {
    await (await hansomeToken.approve(UNISWAP_V4.permit2, MaxUint256)).wait();
  }
  const permit2Allowance = await permit2.allowance(liqAddr, hansomeAddress, UNISWAP_V4.positionManager);
  const nowSec = Math.floor(Date.now() / 1000);
  if (BigInt(permit2Allowance[0]) < hansomeNeeded || Number(permit2Allowance[1]) <= nowSec) {
    await (
      await permit2.approve(hansomeAddress, UNISWAP_V4.positionManager, 2n ** 160n - 1n, nowSec + 86_400)
    ).wait();
  }

  const positionIdBefore: bigint = await positionManager.nextTokenId();
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

  const posL: bigint = await positionManager.getPositionLiquidity(positionId);
  const [fundingAfter, liqEthAfter, liqHAfter] = await Promise.all([
    ethers.provider.getBalance(fundingAddr),
    ethers.provider.getBalance(liqAddr),
    hansomeToken.balanceOf(liqAddr) as Promise<bigint>,
  ]);

  console.log("");
  console.log("Done");
  console.log(`  mint tx:      ${receipt.hash}`);
  console.log(`  positionId:   ${positionId.toString()} L=${posL.toString()}`);
  console.log(`  funding left: ${formatEther(fundingAfter)} ETH (target keep ${formatEther(keepFunding)})`);
  console.log(`  liq left:     ${formatEther(liqEthAfter)} ETH + ${formatUnits(liqHAfter, decimals)} HANSOME`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
