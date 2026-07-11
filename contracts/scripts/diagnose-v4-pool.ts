/**
 * On-chain diagnostic for UGLY/ETH Uniswap v4 pool on Robinhood Mainnet.
 * Run: npx hardhat run scripts/diagnose-v4-pool.ts --network robinhood
 */
import {
  AbiCoder,
  Contract,
  Interface,
  Log,
  ZeroAddress,
  formatEther,
  formatUnits,
  getAddress,
  parseEther,
  parseUnits,
} from "ethers";
import { ethers } from "hardhat";
import {
  computePoolId,
  encodeSqrtRatioX96,
  getSqrtPriceAtTick,
  getTickAtSqrtPriceX96,
  truncateTickSpacing,
} from "./lib/v4-math";

const POOL_ID = "0x25d3614484fc23f4176097e78158f461f6bb324db9594837e83396a5f3d8e983";
const POSITION_ID = 39500n;
const TX_HASH = "0x52c4f107de8ea6b36ad20bd65d0d141bf0dceab24046888cc588e48ed24ea1b0";
const UGLY = "0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const UNIVERSAL_ROUTER = "0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77";

const ADDR = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
} as const;

const EXPECTED = {
  fee: 3000,
  tickSpacing: 60,
  hooks: ZeroAddress,
  currency0: ZeroAddress,
  currency1: getAddress(UGLY),
  uglyPerEth: 359_402_000n,
  ethAmount: parseEther("0.08"),
  uglyAmount: parseUnits("28752160", 18),
  tickRangeMultiplier: 750,
};

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

  const expectedSqrt = encodeSqrtRatioX96(
    parseUnits(EXPECTED.uglyPerEth.toString(), 18),
    parseEther("1"),
  );
  const expectedTick = getTickAtSqrtPriceX96(expectedSqrt);
  const expectedTickLower = truncateTickSpacing(
    expectedTick - EXPECTED.tickRangeMultiplier * EXPECTED.tickSpacing,
    EXPECTED.tickSpacing,
  );
  const expectedTickUpper = truncateTickSpacing(
    expectedTick + EXPECTED.tickRangeMultiplier * EXPECTED.tickSpacing,
    EXPECTED.tickSpacing,
  );

  const expectedPoolKey = {
    currency0: EXPECTED.currency0,
    currency1: EXPECTED.currency1,
    fee: EXPECTED.fee,
    tickSpacing: EXPECTED.tickSpacing,
    hooks: EXPECTED.hooks,
  };
  const expectedPoolId = computePoolId(expectedPoolKey);

  console.log("=== UGLY/ETH v4 Pool Diagnostic (Robinhood 4663) ===\n");

  // --- 1 & 7: Pool initialize + sqrtPriceX96 ---
  console.log("1 & 7. Pool initialization / sqrtPriceX96");
  const slot0 = await stateView.getSlot0(POOL_ID);
  console.log(`  StateView.getSlot0(${POOL_ID}):`);
  console.log(`    sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
  console.log(`    tick:         ${slot0.tick.toString()}`);
  console.log(`    protocolFee:  ${slot0.protocolFee.toString()}`);
  console.log(`    lpFee:        ${slot0.lpFee.toString()}`);
  console.log(`  Expected sqrtPriceX96: ${expectedSqrt.toString()}`);
  console.log(`  Expected tick:         ${expectedTick}`);
  console.log(`  Pool initialized:      ${slot0.sqrtPriceX96 > 0n ? "YES" : "NO"}`);
  console.log(`  sqrtPrice matches:     ${slot0.sqrtPriceX96 === expectedSqrt ? "YES" : "NO (on-chain differs)"}`);

  // --- 4: PoolManager liquidity ---
  console.log("\n4. PoolManager liquidity (StateView.getLiquidity)");
  let poolLiquidity = 0n;
  try {
    poolLiquidity = await stateView.getLiquidity(POOL_ID);
    console.log(`  getLiquidity: ${poolLiquidity.toString()}`);
  } catch (e) {
    console.log(`  getLiquidity call failed: ${(e as Error).message}`);
  }

  // --- 5: PoolKey from PositionManager ---
  console.log("\n5. PoolKey consistency");
  console.log(`  Expected PoolId: ${expectedPoolId}`);
  console.log(`  Actual PoolId:   ${POOL_ID}`);
  console.log(`  PoolId match:    ${expectedPoolId.toLowerCase() === POOL_ID.toLowerCase() ? "YES" : "NO"}`);

  let onChainPoolKey: Awaited<ReturnType<typeof positionManager.poolKeys>> | null = null;
  try {
    onChainPoolKey = await positionManager.poolKeys(poolIdToBytes25(POOL_ID));
    console.log("  PositionManager.poolKeys(bytes25):");
    console.log(`    currency0:    ${onChainPoolKey.currency0}`);
    console.log(`    currency1:    ${onChainPoolKey.currency1}`);
    console.log(`    fee:          ${onChainPoolKey.fee.toString()}`);
    console.log(`    tickSpacing:  ${onChainPoolKey.tickSpacing.toString()}`);
    console.log(`    hooks:        ${onChainPoolKey.hooks}`);
  } catch (e) {
    console.log(`  poolKeys call failed: ${(e as Error).message}`);
  }

  // --- 3 & 6: Position 39500 ---
  console.log("\n3 & 6. PositionId 39500");
  let owner = "";
  try {
    owner = await positionManager.ownerOf(POSITION_ID);
    console.log(`  ownerOf(39500): ${owner}`);
  } catch (e) {
    console.log(`  ownerOf failed: ${(e as Error).message}`);
  }

  let posInfoRaw = 0n;
  try {
    posInfoRaw = await positionManager.positionInfo(POSITION_ID);
    const decoded = decodePositionInfo(posInfoRaw);
    console.log(`  positionInfo raw: ${posInfoRaw.toString()}`);
    console.log(`  tickLower:        ${decoded.tickLower}`);
    console.log(`  tickUpper:        ${decoded.tickUpper}`);
    console.log(`  Expected tickLower: ${expectedTickLower}`);
    console.log(`  Expected tickUpper: ${expectedTickUpper}`);
    console.log(`  tickLower match:  ${decoded.tickLower === expectedTickLower ? "YES" : "NO"}`);
    console.log(`  tickUpper match:  ${decoded.tickUpper === expectedTickUpper ? "YES" : "NO"}`);
  } catch (e) {
    console.log(`  positionInfo failed: ${(e as Error).message}`);
  }

  let poolAndPos: Awaited<ReturnType<typeof positionManager.getPoolAndPositionInfo>> | null = null;
  try {
    poolAndPos = await positionManager.getPoolAndPositionInfo(POSITION_ID);
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

  // Tick liquidity at bounds
  if (posInfoRaw > 0n) {
    const { tickLower, tickUpper } = decodePositionInfo(posInfoRaw);
    console.log("\n  Tick liquidity at position bounds:");
    try {
      const lower = await stateView.getTickLiquidity(POOL_ID, tickLower);
      const upper = await stateView.getTickLiquidity(POOL_ID, tickUpper);
      console.log(`    tick ${tickLower}: gross=${lower.liquidityGross.toString()} net=${lower.liquidityNet.toString()}`);
      console.log(`    tick ${tickUpper}: gross=${upper.liquidityGross.toString()} net=${upper.liquidityNet.toString()}`);
    } catch (e) {
      console.log(`    getTickLiquidity failed: ${(e as Error).message}`);
    }
  }

  // --- 2: Transaction receipt analysis ---
  console.log("\n2. Create transaction logs");
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  if (!receipt) {
    console.log(`  Receipt not found for ${TX_HASH}`);
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

  // --- 8: Alternate pool keys (WETH vs native ETH) ---
  console.log("\n8. PoolKey variants & Router discovery");
  const wethPoolKey = {
    currency0: getAddress(WETH) < getAddress(UGLY) ? WETH : UGLY,
    currency1: getAddress(WETH) < getAddress(UGLY) ? UGLY : WETH,
    fee: 3000,
    tickSpacing: 60,
    hooks: ZeroAddress,
  };
  const wethPoolId = computePoolId({
    currency0: wethPoolKey.currency0,
    currency1: wethPoolKey.currency1,
    fee: wethPoolKey.fee,
    tickSpacing: wethPoolKey.tickSpacing,
    hooks: wethPoolKey.hooks,
  });

  let wethSlot0 = { sqrtPriceX96: 0n };
  try {
    wethSlot0 = await stateView.getSlot0(wethPoolId);
  } catch {
    // ignore
  }

  console.log(`  Native ETH pool (currency0=0x0):`);
  console.log(`    PoolId: ${expectedPoolId}`);
  console.log(`    initialized: ${slot0.sqrtPriceX96 > 0n}`);
  console.log(`    liquidity:   ${poolLiquidity.toString()}`);
  console.log(`  WETH/UGLY pool (currency0=WETH sorted):`);
  console.log(`    WETH:   ${WETH}`);
  console.log(`    PoolId: ${wethPoolId}`);
  console.log(`    initialized: ${wethSlot0.sqrtPriceX96 > 0n}`);
  console.log(`    sqrtPriceX96: ${wethSlot0.sqrtPriceX96.toString()}`);

  // Check Universal Router bytecode exists
  const urCode = await provider.getCode(UNIVERSAL_ROUTER);
  console.log(`\n  Universal Router (${UNIVERSAL_ROUTER}):`);
  console.log(`    deployed: ${urCode !== "0x" ? "YES" : "NO"} (${(urCode.length - 2) / 2} bytes)`);

  // --- Summary ---
  console.log("\n=== Summary ===");
  const checks = {
    poolInitialized: slot0.sqrtPriceX96 > 0n,
    poolIdMatches: expectedPoolId.toLowerCase() === POOL_ID.toLowerCase(),
    hasPoolLiquidity: poolLiquidity > 0n,
    positionExists: owner !== "",
    txSuccess: receipt?.status === 1,
  };
  console.log(JSON.stringify(checks, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
