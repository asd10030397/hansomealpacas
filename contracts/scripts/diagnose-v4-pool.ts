/**
 * On-chain diagnostic for the HANSOME/ETH Uniswap v4 pool on Robinhood Mainnet.
 *
 * All identifiers are optional env inputs — nothing about a specific pool,
 * position, or transaction is hardcoded. Without any env vars set, this
 * reports on the default HANSOME/ETH pool key (computed, not hardcoded).
 *
 * Run: npx hardhat run scripts/diagnose-v4-pool.ts --network robinhood
 * Optional env: POOL_ID, POSITION_ID, TX_HASH
 */
import {
  Contract,
  Interface,
  Log,
  ZeroAddress,
  formatEther,
  formatUnits,
  getAddress,
} from "ethers";
import { ethers } from "hardhat";
import { computePoolId } from "./lib/v4-math";
import { resolveHansomeAddress, resolveLpFee, resolveTickSpacing } from "./lib/pool-config";

const UNIVERSAL_ROUTER = "0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77";

const ADDR = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
} as const;

const stateViewAbi = [
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
  "function getTickLiquidity(bytes32 poolId, int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet)",
  "function getPositionInfo(bytes32 poolId, address owner, int24 tickLower, int24 tickUpper, bytes32 salt) view returns (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128)",
];

const positionManagerAbi = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function positionInfo(uint256 tokenId) view returns (uint256 info)",
  "function getPoolAndPositionInfo(uint256 tokenId) view returns ((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks), uint256 info)",
  "function poolKeys(bytes25 poolId) view returns (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const poolManagerAbi = [
  "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)",
  "event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)",
];

function decodePositionInfo(info: bigint) {
  const n = info;
  const tickUpper = Number((n >> 32n) & 0xffffffn);
  const tickLowerRaw = Number((n >> 8n) & 0xffffffn);
  const tickLower = tickLowerRaw >= 0x800000 ? tickLowerRaw - 0x1000000 : tickLowerRaw;
  const tickUpperSigned = tickUpper >= 0x800000 ? tickUpper - 0x1000000 : tickUpper;
  const hasSubscriber = (n & 0xffn) !== 0n;
  return { tickLower, tickUpper: tickUpperSigned, hasSubscriber, raw: info.toString() };
}

function poolIdToBytes25(poolId: string): string {
  return poolId.slice(0, 52);
}

async function main() {
  const provider = ethers.provider;
  const stateView = new Contract(ADDR.stateView, stateViewAbi, provider);
  const positionManager = new Contract(ADDR.positionManager, positionManagerAbi, provider);
  const poolManagerIface = new Interface(poolManagerAbi);

  const hansomeAddress = resolveHansomeAddress();
  const lpFee = resolveLpFee();
  const tickSpacing = resolveTickSpacing();

  const defaultPoolKey = {
    currency0: ZeroAddress,
    currency1: getAddress(hansomeAddress),
    fee: lpFee,
    tickSpacing,
    hooks: ZeroAddress,
  };
  const defaultPoolId = computePoolId(defaultPoolKey);
  const poolId = process.env.POOL_ID?.trim() || defaultPoolId;
  const positionId = process.env.POSITION_ID?.trim() ? BigInt(process.env.POSITION_ID.trim()) : undefined;
  const txHash = process.env.TX_HASH?.trim();

  console.log("=== HANSOME/ETH v4 Pool Diagnostic (Robinhood 4663) ===\n");
  console.log(`Token:   ${hansomeAddress}`);
  console.log(`Fee:     ${lpFee}`);
  console.log(`Spacing: ${tickSpacing}`);
  console.log(`PoolId:  ${poolId}${process.env.POOL_ID ? " (from env)" : " (computed from token/fee/spacing)"}`);

  // --- Pool initialize + sqrtPriceX96 ---
  console.log("\n1. Pool initialization / sqrtPriceX96");
  const slot0 = await stateView.getSlot0(poolId);
  console.log(`  StateView.getSlot0(${poolId}):`);
  console.log(`    sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
  console.log(`    tick:         ${slot0.tick.toString()}`);
  console.log(`    protocolFee:  ${slot0.protocolFee.toString()}`);
  console.log(`    lpFee:        ${slot0.lpFee.toString()}`);
  console.log(`  Pool initialized: ${slot0.sqrtPriceX96 > 0n ? "YES" : "NO"}`);

  // --- PoolManager liquidity ---
  console.log("\n2. PoolManager liquidity (StateView.getLiquidity)");
  let poolLiquidity = 0n;
  try {
    poolLiquidity = await stateView.getLiquidity(poolId);
    console.log(`  getLiquidity: ${poolLiquidity.toString()}`);
  } catch (e) {
    console.log(`  getLiquidity call failed: ${(e as Error).message}`);
  }

  // --- PoolKey from PositionManager ---
  console.log("\n3. PoolKey consistency");
  let onChainPoolKey: Awaited<ReturnType<typeof positionManager.poolKeys>> | null = null;
  try {
    onChainPoolKey = await positionManager.poolKeys(poolIdToBytes25(poolId));
    console.log("  PositionManager.poolKeys(bytes25):");
    console.log(`    currency0:    ${onChainPoolKey.currency0}`);
    console.log(`    currency1:    ${onChainPoolKey.currency1}`);
    console.log(`    fee:          ${onChainPoolKey.fee.toString()}`);
    console.log(`    tickSpacing:  ${onChainPoolKey.tickSpacing.toString()}`);
    console.log(`    hooks:        ${onChainPoolKey.hooks}`);
  } catch (e) {
    console.log(`  poolKeys call failed: ${(e as Error).message}`);
  }

  // --- Position (only if POSITION_ID provided) ---
  let owner = "";
  let posInfoRaw = 0n;
  if (positionId !== undefined) {
    console.log(`\n4. PositionId ${positionId}`);
    try {
      owner = await positionManager.ownerOf(positionId);
      console.log(`  ownerOf(${positionId}): ${owner}`);
    } catch (e) {
      console.log(`  ownerOf failed: ${(e as Error).message}`);
    }

    try {
      posInfoRaw = await positionManager.positionInfo(positionId);
      const decoded = decodePositionInfo(posInfoRaw);
      console.log(`  positionInfo raw: ${posInfoRaw.toString()}`);
      console.log(`  tickLower:        ${decoded.tickLower}`);
      console.log(`  tickUpper:        ${decoded.tickUpper}`);
    } catch (e) {
      console.log(`  positionInfo failed: ${(e as Error).message}`);
    }

    try {
      const poolAndPos = await positionManager.getPoolAndPositionInfo(positionId);
      const [pk, info] = poolAndPos;
      const decoded = decodePositionInfo(info);
      console.log("  getPoolAndPositionInfo:");
      console.log(`    currency0:   ${pk.currency0}`);
      console.log(`    currency1:   ${pk.currency1}`);
      console.log(`    fee:         ${pk.fee.toString()}`);
      console.log(`    tickSpacing: ${pk.tickSpacing.toString()}`);
      console.log(`    hooks:       ${pk.hooks}`);
      console.log(`    tickLower:   ${decoded.tickLower}`);
      console.log(`    tickUpper:   ${decoded.tickUpper}`);
    } catch (e) {
      console.log(`  getPoolAndPositionInfo failed: ${(e as Error).message}`);
    }

    if (posInfoRaw > 0n) {
      const { tickLower, tickUpper } = decodePositionInfo(posInfoRaw);
      console.log("\n  Tick liquidity at position bounds:");
      try {
        const lower = await stateView.getTickLiquidity(poolId, tickLower);
        const upper = await stateView.getTickLiquidity(poolId, tickUpper);
        console.log(`    tick ${tickLower}: gross=${lower.liquidityGross.toString()} net=${lower.liquidityNet.toString()}`);
        console.log(`    tick ${tickUpper}: gross=${upper.liquidityGross.toString()} net=${upper.liquidityNet.toString()}`);
      } catch (e) {
        console.log(`    getTickLiquidity failed: ${(e as Error).message}`);
      }
    }
  } else {
    console.log("\n4. PositionId — skipped (set POSITION_ID env var to inspect a specific position)");
  }

  // --- Transaction receipt analysis (only if TX_HASH provided) ---
  let receipt: Awaited<ReturnType<typeof provider.getTransactionReceipt>> = null;
  if (txHash) {
    console.log("\n5. Create transaction logs");
    receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      console.log(`  Receipt not found for ${txHash}`);
    } else {
      console.log(`  status:      ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
      console.log(`  blockNumber: ${receipt.blockNumber}`);
      console.log(`  gasUsed:     ${receipt.gasUsed.toString()}`);
      console.log(`  to:          ${receipt.to}`);

      let initializeFound = false;
      let modifyLiquidityFound = false;
      let mintNftFound = false;

      for (const log of receipt.logs as Log[]) {
        if (log.address.toLowerCase() === ADDR.poolManager.toLowerCase()) {
          try {
            const parsed = poolManagerIface.parseLog(log);
            if (parsed?.name === "Initialize") {
              initializeFound = true;
              console.log("\n  PoolManager.Initialize event:");
              console.log(`    id:           ${parsed.args.id}`);
              console.log(`    currency0:    ${parsed.args.currency0}`);
              console.log(`    currency1:    ${parsed.args.currency1}`);
              console.log(`    fee:          ${parsed.args.fee.toString()}`);
              console.log(`    tickSpacing:  ${parsed.args.tickSpacing.toString()}`);
              console.log(`    hooks:        ${parsed.args.hooks}`);
              console.log(`    sqrtPriceX96: ${parsed.args.sqrtPriceX96.toString()}`);
              console.log(`    tick:         ${parsed.args.tick.toString()}`);
            }
            if (parsed?.name === "ModifyLiquidity") {
              modifyLiquidityFound = true;
              console.log("\n  PoolManager.ModifyLiquidity event:");
              console.log(`    id:              ${parsed.args.id}`);
              console.log(`    sender:          ${parsed.args.sender}`);
              console.log(`    tickLower:       ${parsed.args.tickLower.toString()}`);
              console.log(`    tickUpper:       ${parsed.args.tickUpper.toString()}`);
              console.log(`    liquidityDelta:  ${parsed.args.liquidityDelta.toString()}`);
              console.log(`    salt:            ${parsed.args.salt}`);
            }
          } catch {
            // not a PoolManager event we know
          }
        }

        if (log.address.toLowerCase() === ADDR.positionManager.toLowerCase()) {
          const pmIface = new Interface(positionManagerAbi);
          try {
            const parsed = pmIface.parseLog(log);
            if (parsed?.name === "Transfer" && parsed.args.from === ZeroAddress) {
              mintNftFound = true;
              console.log("\n  PositionManager NFT mint:");
              console.log(`    tokenId: ${parsed.args.tokenId.toString()}`);
              console.log(`    to:      ${parsed.args.to}`);
            }
          } catch {
            // ignore
          }
        }
      }

      console.log(`\n  Initialize event found:      ${initializeFound ? "YES" : "NO"}`);
      console.log(`  ModifyLiquidity event found: ${modifyLiquidityFound ? "YES" : "NO"}`);
      console.log(`  Position NFT mint found:     ${mintNftFound ? "YES" : "NO"}`);
    }
  } else {
    console.log("\n5. Create transaction logs — skipped (set TX_HASH env var to inspect a specific tx)");
  }

  // Check Universal Router bytecode exists
  const urCode = await provider.getCode(UNIVERSAL_ROUTER);
  console.log(`\n6. Universal Router (${UNIVERSAL_ROUTER}):`);
  console.log(`    deployed: ${urCode !== "0x" ? "YES" : "NO"} (${(urCode.length - 2) / 2} bytes)`);

  // --- Summary ---
  console.log("\n=== Summary ===");
  const checks = {
    poolInitialized: slot0.sqrtPriceX96 > 0n,
    hasPoolLiquidity: poolLiquidity > 0n,
    positionExists: positionId !== undefined ? owner !== "" : undefined,
    txSuccess: receipt ? receipt.status === 1 : undefined,
  };
  console.log(JSON.stringify(checks, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
