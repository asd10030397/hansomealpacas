/**
 * Mint a brand-new Uniswap v4 Position NFT on the existing, already-initialized
 * HANSOME/ETH pool — does NOT create a pool (use create-v4-pool.ts for that,
 * once) and does NOT touch any existing Position NFT (use add-v4-liquidity.ts
 * to increase an existing, unlocked position instead).
 *
 * Use this when adding a *second* (or third, ...) liquidity position at a
 * different tick range than an existing one — e.g. because the existing
 * position is locked in TitanLockerManagerV2 and can no longer be increased.
 *
 * Uses PositionManager.modifyLiquidities with the MINT_POSITION action.
 * The pool key (currency0=ETH native, currency1=HANSOME, fee, tickSpacing,
 * hooks) is asserted against the live on-chain pool state before minting —
 * nothing about the pool is assumed, only the tick range and amounts.
 *
 * Required env (contracts/.env or inline):
 *   MINT_TICK_LOWER=160000
 *   MINT_TICK_UPPER=240000
 *   MINT_ETH_AMOUNT=0.0762
 *   MINT_HANSOME_AMOUNT=31257572
 *
 * Run:
 *   MINT_TICK_LOWER=160000 MINT_TICK_UPPER=240000 MINT_ETH_AMOUNT=0.0762 \
 *     MINT_HANSOME_AMOUNT=31257572 DRY_RUN=1 \
 *     npx hardhat run scripts/mint-v4-liquidity.ts --network robinhood
 *   (drop DRY_RUN=1 to send the real transaction)
 */
import { AbiCoder, Contract, formatEther, formatUnits, getAddress, parseEther, parseUnits, solidityPacked, MaxUint256, ZeroAddress } from "ethers";
import { ethers, network } from "hardhat";
import {
  computePoolId,
  getLiquidityForAmounts,
  getSqrtPriceAtTick,
  truncateTickSpacing,
} from "./lib/v4-math";
import { getTreasurySigner } from "./lib/signer";
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

const positionManagerAbi = [
  "function modifyLiquidities(bytes unlockData, uint256 deadline) payable",
  "function nextTokenId() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const erc20Abi = [
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const permit2Abi = [
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
];

const stateViewAbi = ["function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"];

function requireEnv(name: string): string {
  const raw = process.env[name]?.trim();
  if (!raw) {
    throw new Error(`Missing ${name}. Set it explicitly (contracts/.env or inline) before running.`);
  }
  return raw;
}

function requireEnvInt(name: string): number {
  return Number(requireEnv(name));
}

type PoolKey = {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
};

function buildMintLiquidityParams(
  poolKey: PoolKey,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  amount0Max: bigint,
  amount1Max: bigint,
  recipient: string,
) {
  const actions = solidityPacked(
    ["uint8", "uint8", "uint8", "uint8"],
    [ACTIONS.MINT_POSITION, ACTIONS.SETTLE_PAIR, ACTIONS.SWEEP, ACTIONS.SWEEP],
  );

  const poolKeyTuple = [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks];

  const params = [
    AbiCoder.defaultAbiCoder().encode(
      ["tuple(address,address,uint24,int24,address)", "int24", "int24", "uint256", "uint128", "uint128", "address", "bytes"],
      [poolKeyTuple, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency0, poolKey.currency1]),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency0, recipient]),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency1, recipient]),
  ];

  return AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected Robinhood Mainnet (${ROBINHOOD_CHAIN_ID}), got ${chainId}`);
  }

  const signer = await getTreasurySigner(ethers.provider);
  const recipient = await signer.getAddress();

  const tickLowerRaw = requireEnvInt("MINT_TICK_LOWER");
  const tickUpperRaw = requireEnvInt("MINT_TICK_UPPER");
  const ethAmount = parseEther(requireEnv("MINT_ETH_AMOUNT"));
  const hansomeAmount = parseUnits(requireEnv("MINT_HANSOME_AMOUNT"), 18);

  const hansomeAddress = resolveHansomeAddress();
  const lpFee = resolveLpFee();
  const tickSpacing = resolveTickSpacing();

  const tickLower = truncateTickSpacing(tickLowerRaw, tickSpacing);
  const tickUpper = truncateTickSpacing(tickUpperRaw, tickSpacing);
  if (tickLower !== tickLowerRaw || tickUpper !== tickUpperRaw) {
    console.log(`Note: ticks snapped to tickSpacing=${tickSpacing} → [${tickLower}, ${tickUpper}]`);
  }
  if (tickLower >= tickUpper) {
    throw new Error(`Invalid range: tickLower ${tickLower} >= tickUpper ${tickUpper}`);
  }

  const hansomeToken = new Contract(hansomeAddress, erc20Abi, signer);
  const positionManager = new Contract(UNISWAP_V4.positionManager, positionManagerAbi, signer);
  const permit2 = new Contract(UNISWAP_V4.permit2, permit2Abi, signer);
  const stateView = new Contract(UNISWAP_V4.stateView, stateViewAbi, ethers.provider);

  const poolKey: PoolKey = {
    currency0: ZeroAddress,
    currency1: getAddress(hansomeAddress),
    fee: lpFee,
    tickSpacing,
    hooks: ZeroAddress,
  };
  const poolId = computePoolId(poolKey);

  console.log("Mint new Uniswap v4 Position NFT (MINT_POSITION, existing pool)");
  console.log(`  Network:          ${network.name} (${chainId})`);
  console.log(`  Treasury:         ${recipient}`);
  console.log(`  PositionManager:  ${UNISWAP_V4.positionManager}`);
  console.log(`  PoolId:           ${poolId}`);
  console.log(`  Tick range:       [${tickLower}, ${tickUpper}]`);
  console.log(`  ETH amount:       ${formatEther(ethAmount)}`);
  console.log(`  HANSOME amount:   ${formatUnits(hansomeAmount, 18)}`);

  const slot0 = await stateView.getSlot0(poolId);
  if (slot0.sqrtPriceX96 === 0n) {
    throw new Error(`Pool ${poolId} is not initialized — run create-v4-pool.ts first, this script only mints on an existing pool`);
  }
  const currentTick = Number(slot0.tick);
  const inRange = currentTick >= tickLower && currentTick < tickUpper;

  console.log("");
  console.log("Current pool state");
  console.log(`  sqrtPriceX96:     ${slot0.sqrtPriceX96.toString()}`);
  console.log(`  tick:             ${currentTick}`);
  console.log(`  lpFee:            ${slot0.lpFee.toString()} (expected ${lpFee})`);
  console.log(`  new range in-range: ${inRange}`);

  if (Number(slot0.lpFee) !== lpFee) {
    throw new Error(`Pool lpFee ${slot0.lpFee} != expected ${lpFee} — wrong pool, aborting`);
  }
  if (!inRange) {
    console.log("  WARNING: current tick is outside the requested range — this position would be 100% one-sided until price moves back in range.");
  }

  const sqrtPriceLower = getSqrtPriceAtTick(tickLower);
  const sqrtPriceUpper = getSqrtPriceAtTick(tickUpper);
  const liquidity = getLiquidityForAmounts(slot0.sqrtPriceX96, sqrtPriceLower, sqrtPriceUpper, ethAmount, hansomeAmount);

  if (liquidity === 0n) {
    throw new Error("Computed liquidity is zero — check amounts against the requested range and current price");
  }

  console.log(`  Computed liquidity: ${liquidity.toString()}`);

  const [symbol, decimals, ethBalance, hansomeBalance, erc20Allowance, permit2Allowance] = await Promise.all([
    hansomeToken.symbol(),
    hansomeToken.decimals(),
    ethers.provider.getBalance(recipient),
    hansomeToken.balanceOf(recipient),
    hansomeToken.allowance(recipient, UNISWAP_V4.permit2),
    permit2.allowance(recipient, hansomeAddress, UNISWAP_V4.positionManager),
  ]);

  const nowSec = Math.floor(Date.now() / 1000);
  const permit2AllowanceAmount: bigint = permit2Allowance[0];
  const permit2AllowanceExpiration: bigint = permit2Allowance[1];
  const permit2AllowanceValid = permit2AllowanceAmount >= hansomeAmount && Number(permit2AllowanceExpiration) > nowSec;

  console.log("");
  console.log("Pre-flight checks");
  console.log(`  Token:                      ${hansomeAddress} (${symbol}, decimals=${decimals})`);
  console.log(`  Treasury ETH:               ${formatEther(ethBalance)} (need ${formatEther(ethAmount)})`);
  console.log(`  Treasury HANSOME:           ${formatUnits(hansomeBalance, decimals)} (need ${formatUnits(hansomeAmount, decimals)})`);
  console.log(`  HANSOME -> Permit2:         ${erc20Allowance.toString()} (need >= ${hansomeAmount.toString()})`);
  console.log(`  Permit2 -> PositionManager: amount=${permit2AllowanceAmount.toString()} expiration=${permit2AllowanceExpiration.toString()} (need >= ${hansomeAmount.toString()}, unexpired)`);

  const failures: string[] = [];
  if (ethBalance < ethAmount) {
    failures.push(`Insufficient Treasury ETH: have ${formatEther(ethBalance)}, need ${formatEther(ethAmount)}`);
  }
  if (hansomeBalance < hansomeAmount) {
    failures.push(`Insufficient Treasury HANSOME: have ${formatUnits(hansomeBalance, decimals)}, need ${formatUnits(hansomeAmount, decimals)}`);
  }
  if (failures.length > 0) {
    console.log("");
    console.log("Pre-flight checks: FAIL — no transaction will be sent");
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
    throw new Error("Pre-flight checks failed — aborting before sending any transaction");
  }

  const isDryRun = process.env.DRY_RUN === "1";

  if (!isDryRun && erc20Allowance < hansomeAmount) {
    console.log("");
    console.log("Approving HANSOME → Permit2...");
    const approveTx = await hansomeToken.approve(UNISWAP_V4.permit2, MaxUint256);
    await approveTx.wait();
  }
  if (!isDryRun && !permit2AllowanceValid) {
    console.log("Approving Permit2 → PositionManager for HANSOME...");
    const expiration = Math.floor(Date.now() / 1000) + 86_400;
    const permitTx = await permit2.approve(hansomeAddress, UNISWAP_V4.positionManager, 2n ** 160n - 1n, expiration);
    await permitTx.wait();
  }

  const amount0Max = ethAmount + 1n;
  const amount1Max = hansomeAmount + 1n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const unlockData = buildMintLiquidityParams(poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient);

  if (isDryRun) {
    console.log("");
    console.log("Pre-flight checks: PASS");
    console.log("DRY_RUN=1 — simulating MINT_POSITION (no transaction sent, no liquidity added)");
    console.log("Note: allowance/approve steps are skipped in DRY_RUN — if allowances above show insufficient, the real run will approve them automatically before minting.");

    if (erc20Allowance >= hansomeAmount && permit2AllowanceValid) {
      await positionManager.modifyLiquidities.staticCall(unlockData, deadline, { value: amount0Max });
      console.log("  staticCall:       PASSED (mint + settle pair + sweep)");
    } else {
      console.log("  staticCall:       SKIPPED (allowances not yet set — would be approved automatically in a real run)");
    }
    console.log(`  PoolId:           ${poolId} (unchanged, existing pool)`);
    console.log(`  Tick range:       [${tickLower}, ${tickUpper}]`);
    console.log(`  Liquidity:        ${liquidity.toString()}`);
    console.log(`  Would spend ETH:      up to ${formatEther(amount0Max)}`);
    console.log(`  Would spend HANSOME:  up to ${formatUnits(amount1Max, 18)}`);
    console.log("  DRY_RUN:          ALL CHECKS PASSED — no new Position NFT minted, no liquidity added");
    return;
  }

  console.log("");
  console.log("Pre-flight checks: PASS");
  console.log("Submitting PositionManager.modifyLiquidities (MINT_POSITION)...");

  const positionIdBefore: bigint = await positionManager.nextTokenId();
  const ethBefore = await ethers.provider.getBalance(recipient);
  const hansomeBefore = await hansomeToken.balanceOf(recipient);

  const tx = await positionManager.modifyLiquidities(unlockData, deadline, { value: amount0Max });
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction failed — no receipt returned");
  }

  let positionId = positionIdBefore;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== UNISWAP_V4.positionManager.toLowerCase()) {
      continue;
    }
    try {
      const parsed = positionManager.interface.parseLog(log);
      if (parsed?.name === "Transfer" && parsed.args.from === ZeroAddress) {
        positionId = parsed.args.tokenId;
      }
    } catch {
      // ignore unrelated logs
    }
  }

  const owner = await positionManager.ownerOf(positionId);
  if (owner.toLowerCase() !== recipient.toLowerCase()) {
    throw new Error(`Post-tx check failed: Position ${positionId} owner is ${owner}, expected treasury ${recipient}`);
  }

  const positionLiquidity: bigint = await positionManager.getPositionLiquidity(positionId);
  if (positionLiquidity === 0n) {
    throw new Error("Post-tx check failed: minted position has zero liquidity");
  }

  const ethAfter = await ethers.provider.getBalance(recipient);
  const hansomeAfter = await hansomeToken.balanceOf(recipient);
  const gasUsed = receipt.gasUsed as bigint;
  const gasPrice = (receipt.gasPrice ?? tx.gasPrice ?? 0n) as bigint;
  const gasPaid = gasUsed * gasPrice;
  const ethSpent = ethBefore - ethAfter - gasPaid;
  const hansomeSpent = hansomeBefore - hansomeAfter;

  console.log("");
  console.log("New Position NFT minted");
  console.log(`  Transaction Hash:    ${receipt.hash}`);
  console.log(`  Block Number:        ${receipt.blockNumber}`);
  console.log(`  PositionId:          ${positionId.toString()} (persist this — needed for lock/remove/query scripts)`);
  console.log(`  PoolId:              ${poolId} (unchanged — same pool)`);
  console.log(`  Tick range:          [${tickLower}, ${tickUpper}]`);
  console.log(`  Gas Used:            ${gasUsed.toString()}`);
  console.log(`  Gas Price:           ${gasPrice.toString()} wei`);
  console.log(`  Gas Cost:            ${formatEther(gasPaid)} ETH`);
  console.log(`  ETH added:           ${formatEther(ethSpent)} (${ethSpent.toString()} wei)`);
  console.log(`  HANSOME added:       ${formatUnits(hansomeSpent, 18)} (${hansomeSpent.toString()} wei)`);
  console.log(`  Position liquidity:  ${positionLiquidity.toString()}`);
  console.log(`  Explorer:            https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
