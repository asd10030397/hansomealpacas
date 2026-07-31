/**
 * Phase 11F — value Hook positions via StateView L + CLMM amounts.
 * Forbidden: PoolManager ERC-20 balances; StateView.getLiquidity as total L.
 */

import { getAddress, type Address, type PublicClient } from "viem";
import { STATE_VIEW_ADDRESS } from "@/lib/chain";
import { stateViewAbi } from "@/lib/hansome-score/constants";
import { RH_QUOTE_TOKENS } from "@/lib/hansome-score/lp/deployments";
import { STATE_VIEW_POSITION_ABI } from "@/lib/hansome-score/lp/hook-position-index/abis";
import { normalizeBytes32 } from "@/lib/hansome-score/lp/hook-position-index/decode";
import type { HookPositionIndexState } from "@/lib/hansome-score/lp/hook-position-index/types";
import { amountsForLiquidity, type TokenPriceBook } from "@/lib/hansome-score/lp/position-value";
import { KNOWN_HOOK_NATIVE_POOLS } from "@/lib/hansome-score/lp/v4-ownership-class";
import type {
  HookPositionValuation,
  HookPositionValuationPublic,
  HookPositionValuationSummary,
  HookValuationIncompleteReason,
  HookValuationResult,
  HookValuationTerminalState,
} from "@/lib/hansome-score/lp/hook-position-valuer/types";

const ZERO = 0n;

export type HookSlot0 = {
  sqrtPriceX96: bigint;
  tick: number;
};

export type HookValuationPort = {
  getBlockNumber(): Promise<number>;
  getSlot0(poolId: string): Promise<HookSlot0 | null>;
  getPositionLiquidity(params: {
    poolId: string;
    owner: string;
    tickLower: number;
    tickUpper: number;
    salt: string;
  }): Promise<bigint | null>;
  getErc20Decimals?(address: string): Promise<number | null>;
};

export type ValueHookPositionsParams = {
  index: HookPositionIndexState;
  port: HookValuationPort;
  tokenAddress: string;
  tokenDecimals: number;
  priceBook?: TokenPriceBook | null;
  /** Extra USD prices by lowercased address (e.g. GME/RH numeraire). */
  extraUsdPrices?: Record<string, number | null | undefined>;
  /** Tip block at valuation time; defaults to port.getBlockNumber(). */
  tipBlock?: number | null;
  /** Consider tip stale when tip - index.safeHead > this. */
  staleTipDepth?: number;
  generation?: string;
  /** Pre-resolved pool currencies (overrides known fixture). */
  currency0?: string | null;
  currency1?: string | null;
  decimals0?: number | null;
  decimals1?: number | null;
};

function uniqReasons(list: HookValuationIncompleteReason[]): HookValuationIncompleteReason[] {
  return [...new Set(list)];
}

function rawToNormalized(raw: bigint, decimals: number): string {
  if (decimals < 0 || decimals > 36) return raw.toString();
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr.length > 0 ? `${whole}.${fracStr}` : whole.toString();
}

function rawToNumber(raw: bigint, decimals: number): number {
  if (decimals < 0 || decimals > 36) return NaN;
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  return Number(whole) + Number(frac) / Number(base);
}

export function resolveHookPoolCurrencies(params: {
  tokenAddress: string;
  poolId: string;
  currency0?: string | null;
  currency1?: string | null;
}): { currency0: string | null; currency1: string | null } {
  if (params.currency0 && params.currency1) {
    return {
      currency0: getAddress(params.currency0),
      currency1: getAddress(params.currency1),
    };
  }
  const known = KNOWN_HOOK_NATIVE_POOLS.find(
    (p) =>
      p.poolId.toLowerCase() === params.poolId.toLowerCase() ||
      p.token.toLowerCase() === getAddress(params.tokenAddress).toLowerCase(),
  );
  if (known) {
    return {
      currency0: known.poolKey.currency0,
      currency1: known.poolKey.currency1,
    };
  }
  return { currency0: params.currency0 ?? null, currency1: params.currency1 ?? null };
}

export function usdPriceForAddress(
  address: string | null | undefined,
  book: TokenPriceBook | null | undefined,
  extra?: Record<string, number | null | undefined>,
): number | null {
  if (!address) return null;
  const lc = getAddress(address).toLowerCase();
  if (extra && extra[lc] != null && Number(extra[lc]) > 0) {
    return Number(extra[lc]);
  }
  if (!book) return null;
  if (lc === RH_QUOTE_TOKENS.WETH.toLowerCase()) {
    return book.ethUsd != null && book.ethUsd > 0 ? book.ethUsd : null;
  }
  if (lc === RH_QUOTE_TOKENS.USDG.toLowerCase()) {
    return book.usdgUsd ?? 1;
  }
  if (lc === book.tokenAddress.toLowerCase()) {
    return book.tokenPriceUsd != null && book.tokenPriceUsd > 0
      ? book.tokenPriceUsd
      : null;
  }
  return null;
}

export function decimalsForAddress(
  address: string | null | undefined,
  book: TokenPriceBook | null | undefined,
  overrides?: { decimals0?: number | null; decimals1?: number | null; currency0?: string | null; currency1?: string | null },
): number | null {
  if (!address) return null;
  const lc = getAddress(address).toLowerCase();
  if (overrides?.currency0 && lc === getAddress(overrides.currency0).toLowerCase()) {
    if (overrides.decimals0 != null) return overrides.decimals0;
  }
  if (overrides?.currency1 && lc === getAddress(overrides.currency1).toLowerCase()) {
    if (overrides.decimals1 != null) return overrides.decimals1;
  }
  if (lc === RH_QUOTE_TOKENS.WETH.toLowerCase()) return 18;
  if (lc === RH_QUOTE_TOKENS.USDG.toLowerCase()) return 6;
  if (book && lc === book.tokenAddress.toLowerCase()) return book.tokenDecimals;
  return null;
}

function sumBig(a: bigint, b: bigint): bigint {
  return a + b;
}

/**
 * Pure CLMM valuation for one position when L + slot0 are known.
 * Exported for unit tests (below/in/above range).
 */
export function valueSingleHookPosition(params: {
  poolId: string;
  owner: string;
  tickLower: number;
  tickUpper: number;
  salt: string;
  classification: HookPositionValuation["classification"];
  liquidity: bigint;
  sqrtPriceX96: bigint;
  tick: number;
  currency0: string | null;
  currency1: string | null;
  decimals0: number | null;
  decimals1: number | null;
  price0: number | null;
  price1: number | null;
  stateViewValidated: boolean;
}): HookPositionValuation {
  const incomplete: HookValuationIncompleteReason[] = [];
  const active = params.liquidity > ZERO;
  const inRange =
    active &&
    params.tick >= params.tickLower &&
    params.tick < params.tickUpper;

  let amount0Raw = ZERO;
  let amount1Raw = ZERO;
  let mathOk = true;

  if (active) {
    const amounts = amountsForLiquidity({
      liquidity: params.liquidity,
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      sqrtPriceX96: params.sqrtPriceX96,
    });
    if (!amounts) {
      mathOk = false;
      incomplete.push("clmm_math_failed");
    } else {
      amount0Raw = amounts.amount0;
      amount1Raw = amounts.amount1;
    }
  }

  if (params.decimals0 == null || params.decimals1 == null) {
    incomplete.push("decimals_unavailable");
  }
  if (params.price0 == null) incomplete.push("token0_price_unavailable");
  if (params.price1 == null) incomplete.push("token1_price_unavailable");

  const amount0 =
    params.decimals0 != null ? rawToNormalized(amount0Raw, params.decimals0) : undefined;
  const amount1 =
    params.decimals1 != null ? rawToNormalized(amount1Raw, params.decimals1) : undefined;

  let value0Usd: number | undefined;
  let value1Usd: number | undefined;
  let totalValueUsd: number | undefined;
  if (
    mathOk &&
    params.decimals0 != null &&
    params.decimals1 != null &&
    params.price0 != null &&
    params.price1 != null
  ) {
    value0Usd = rawToNumber(amount0Raw, params.decimals0) * params.price0;
    value1Usd = rawToNumber(amount1Raw, params.decimals1) * params.price1;
    if (Number.isFinite(value0Usd) && Number.isFinite(value1Usd)) {
      totalValueUsd = value0Usd + value1Usd;
    } else {
      value0Usd = undefined;
      value1Usd = undefined;
      totalValueUsd = undefined;
    }
  }

  // Token amounts complete when math + decimals OK — USD optional.
  const amountsComplete =
    mathOk && params.decimals0 != null && params.decimals1 != null;

  return {
    poolId: params.poolId.toLowerCase(),
    owner: getAddress(params.owner).toLowerCase(),
    tickLower: params.tickLower,
    tickUpper: params.tickUpper,
    salt: params.salt.toLowerCase(),
    classification: params.classification,
    liquidity: params.liquidity.toString(),
    active: inRange || active, // active = L>0; in-range flagged via tick compare for callers
    amount0Raw: amount0Raw.toString(),
    amount1Raw: amount1Raw.toString(),
    amount0,
    amount1,
    token0UsdPrice: params.price0 ?? undefined,
    token1UsdPrice: params.price1 ?? undefined,
    value0Usd,
    value1Usd,
    totalValueUsd,
    valuationComplete: amountsComplete,
    incompleteReasons: incomplete.length ? uniqReasons(incomplete) : undefined,
    stateViewValidated: params.stateViewValidated,
  };
}

export function aggregateHookValuations(params: {
  poolId: string;
  positions: HookPositionValuation[];
  index: HookPositionIndexState;
  valuedAtBlock?: number;
  pricedAt?: string;
  stale?: boolean;
  terminalState: HookValuationTerminalState;
}): HookPositionValuationSummary {
  const { positions, index } = params;
  const incomplete: HookValuationIncompleteReason[] = [];

  if (!index.hookDiscoveryComplete) incomplete.push("index_incomplete");
  if (params.stale) incomplete.push("stale_tip");

  const active = positions.filter((p) => {
    try {
      return BigInt(p.liquidity) > ZERO;
    } catch {
      return false;
    }
  });
  const hookOwned = positions.filter((p) => p.classification === "hook_owned");
  const activeHook = hookOwned.filter((p) => {
    try {
      return BigInt(p.liquidity) > ZERO;
    } catch {
      return false;
    }
  });
  const foreignPosm = active.filter((p) => p.classification === "foreign_posm");
  const foreignOther = active.filter((p) => p.classification === "foreign_other");

  let a0 = ZERO;
  let a1 = ZERO;
  for (const p of activeHook) {
    try {
      a0 = sumBig(a0, BigInt(p.amount0Raw));
      a1 = sumBig(a1, BigInt(p.amount1Raw));
    } catch {
      /* skip */
    }
  }

  const hookAmountsOk =
    activeHook.length === 0 ||
    activeHook.every((p) => p.valuationComplete && p.amount0 != null && p.amount1 != null);
  const hookUsdOk =
    activeHook.length === 0 ||
    activeHook.every(
      (p) => p.totalValueUsd != null && Number.isFinite(p.totalValueUsd),
    );
  const foreignUsdOk =
    [...foreignPosm, ...foreignOther].length === 0 ||
    [...foreignPosm, ...foreignOther].every(
      (p) => p.totalValueUsd != null && Number.isFinite(p.totalValueUsd),
    );

  for (const p of positions) {
    for (const r of p.incompleteReasons ?? []) {
      incomplete.push(r as HookValuationIncompleteReason);
    }
  }

  const hookOwnedValueUsd = hookUsdOk
    ? activeHook.reduce((s, p) => s + (p.totalValueUsd ?? 0), 0)
    : undefined;
  const foreignPosmValueUsd = foreignPosm.every(
    (p) => p.totalValueUsd != null,
  )
    ? foreignPosm.reduce((s, p) => s + (p.totalValueUsd ?? 0), 0)
    : undefined;
  const foreignOtherValueUsd = foreignOther.every(
    (p) => p.totalValueUsd != null,
  )
    ? foreignOther.reduce((s, p) => s + (p.totalValueUsd ?? 0), 0)
    : undefined;

  let foreignTotalValueUsd: number | undefined;
  if (foreignPosmValueUsd != null && foreignOtherValueUsd != null) {
    foreignTotalValueUsd = foreignPosmValueUsd + foreignOtherValueUsd;
  }

  let reconstructedPoolValueUsd: number | undefined;
  if (hookOwnedValueUsd != null && foreignTotalValueUsd != null) {
    reconstructedPoolValueUsd = hookOwnedValueUsd + foreignTotalValueUsd;
  }

  const hookValuationComplete =
    index.hookDiscoveryComplete && hookAmountsOk && positions.every((p) => {
      if (p.classification !== "hook_owned") return true;
      try {
        if (BigInt(p.liquidity) <= ZERO) return true;
      } catch {
        return false;
      }
      return p.valuationComplete && p.stateViewValidated;
    });

  const foreignValuationComplete =
    index.foreignDiscoveryComplete &&
    foreignUsdOk &&
    [...foreignPosm, ...foreignOther].every((p) => p.valuationComplete);

  const priceDataComplete = hookUsdOk && (activeHook.length === 0 || hookOwnedValueUsd != null);

  return {
    poolId: params.poolId.toLowerCase(),
    indexedPositionCount: positions.length,
    activePositionCount: active.length,
    hookOwnedPositionCount: hookOwned.length,
    activeHookOwnedPositionCount: activeHook.length,
    hookOwnedAmount0Raw: a0.toString(),
    hookOwnedAmount1Raw: a1.toString(),
    hookOwnedValueUsd,
    foreignPosmValueUsd,
    foreignOtherValueUsd,
    foreignTotalValueUsd,
    reconstructedPoolValueUsd,
    hookValuationComplete,
    foreignValuationComplete,
    priceDataComplete,
    valuedAtBlock: params.valuedAtBlock,
    pricedAt: params.pricedAt,
    stale: params.stale,
    incompleteReasons: incomplete.length ? uniqReasons(incomplete) : undefined,
    terminalState: params.terminalState,
  };
}

/** Fix aggregate normalized amounts using decimals. */
export function finalizeAggregateAmounts(
  summary: HookPositionValuationSummary,
  decimals0: number | null,
  decimals1: number | null,
): HookPositionValuationSummary {
  if (summary.hookOwnedAmount0Raw == null || summary.hookOwnedAmount1Raw == null) {
    return summary;
  }
  try {
    const a0 = BigInt(summary.hookOwnedAmount0Raw);
    const a1 = BigInt(summary.hookOwnedAmount1Raw);
    return {
      ...summary,
      hookOwnedAmount0:
        decimals0 != null ? rawToNormalized(a0, decimals0) : summary.hookOwnedAmount0,
      hookOwnedAmount1:
        decimals1 != null ? rawToNormalized(a1, decimals1) : summary.hookOwnedAmount1,
    };
  } catch {
    return summary;
  }
}

export function toPublicHookValuationSummary(
  summary: HookPositionValuationSummary,
): HookPositionValuationPublic {
  return {
    hookOwnedPositionCount: summary.hookOwnedPositionCount,
    activeHookOwnedPositionCount: summary.activeHookOwnedPositionCount,
    hookOwnedAmount0: summary.hookOwnedAmount0,
    hookOwnedAmount1: summary.hookOwnedAmount1,
    hookOwnedValueUsd: summary.hookOwnedValueUsd,
    hookValuationComplete: summary.hookValuationComplete,
    valuedAtBlock: summary.valuedAtBlock,
    incompleteReasons: summary.incompleteReasons,
  };
}

const DEFAULT_CONCURRENCY = 4;

async function mapBounded<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export async function valueHookPositions(
  params: ValueHookPositionsParams,
): Promise<HookValuationResult> {
  const { index, port } = params;
  const poolId = index.poolId.toLowerCase();
  const incomplete: HookValuationIncompleteReason[] = [];
  let terminal: HookValuationTerminalState = "READING_POSITIONS";

  const tip =
    params.tipBlock ??
    (await port.getBlockNumber().catch(() => null));
  const staleTipDepth = params.staleTipDepth ?? 256;
  const stale =
    tip != null &&
    index.safeHeadBlock != null &&
    tip - index.safeHeadBlock > staleTipDepth;

  if (!index.hookDiscoveryComplete) incomplete.push("index_incomplete");
  if (stale) incomplete.push("stale_tip");

  const currencies = resolveHookPoolCurrencies({
    tokenAddress: params.tokenAddress,
    poolId,
    currency0: params.currency0,
    currency1: params.currency1,
  });

  let decimals0 =
    params.decimals0 ??
    decimalsForAddress(currencies.currency0, params.priceBook, {
      currency0: currencies.currency0,
      currency1: currencies.currency1,
      decimals0: params.decimals0,
      decimals1: params.decimals1,
    });
  let decimals1 =
    params.decimals1 ??
    decimalsForAddress(currencies.currency1, params.priceBook, {
      currency0: currencies.currency0,
      currency1: currencies.currency1,
      decimals0: params.decimals0,
      decimals1: params.decimals1,
    });

  // Token side often matches book.tokenDecimals
  const tokenLc = getAddress(params.tokenAddress).toLowerCase();
  if (
    decimals0 == null &&
    currencies.currency0 &&
    getAddress(currencies.currency0).toLowerCase() === tokenLc
  ) {
    decimals0 = params.tokenDecimals;
  }
  if (
    decimals1 == null &&
    currencies.currency1 &&
    getAddress(currencies.currency1).toLowerCase() === tokenLc
  ) {
    decimals1 = params.tokenDecimals;
  }
  if (decimals0 == null && currencies.currency0 && port.getErc20Decimals) {
    decimals0 = await port.getErc20Decimals(currencies.currency0);
  }
  if (decimals1 == null && currencies.currency1 && port.getErc20Decimals) {
    decimals1 = await port.getErc20Decimals(currencies.currency1);
  }

  terminal = "CALCULATING";
  const slot0 = await port.getSlot0(poolId);
  if (!slot0) {
    incomplete.push("slot0_unavailable");
    terminal = "FAILED_TERMINAL";
    const emptySummary: HookPositionValuationSummary = {
      poolId,
      indexedPositionCount: index.positions.length,
      activePositionCount: 0,
      hookOwnedPositionCount: index.positions.filter(
        (p) => p.classification === "hook_owned",
      ).length,
      activeHookOwnedPositionCount: 0,
      hookValuationComplete: false,
      foreignValuationComplete: false,
      priceDataComplete: false,
      valuedAtBlock: tip ?? undefined,
      pricedAt: params.priceBook ? new Date().toISOString() : undefined,
      stale,
      incompleteReasons: uniqReasons(incomplete),
      terminalState: terminal,
    };
    return {
      summary: emptySummary,
      publicSummary: toPublicHookValuationSummary(emptySummary),
      positions: [],
      currency0: currencies.currency0,
      currency1: currencies.currency1,
      decimals0,
      decimals1,
      sqrtPriceX96: null,
      tick: null,
      valuedAtBlock: tip,
      pricedAt: params.priceBook ? new Date().toISOString() : null,
      stale,
      generation: params.generation ?? index.generation,
      terminalState: terminal,
    };
  }

  terminal = "PRICING";
  const price0 = usdPriceForAddress(
    currencies.currency0,
    params.priceBook,
    params.extraUsdPrices,
  );
  const price1 = usdPriceForAddress(
    currencies.currency1,
    params.priceBook,
    params.extraUsdPrices,
  );

  const positions = await mapBounded(
    index.positions,
    DEFAULT_CONCURRENCY,
    async (rec): Promise<HookPositionValuation> => {
      let L: bigint | null = null;
      let validated = false;
      try {
        L = await port.getPositionLiquidity({
          poolId,
          owner: rec.owner,
          tickLower: rec.tickLower,
          tickUpper: rec.tickUpper,
          salt: rec.salt,
        });
        validated = L != null;
      } catch {
        L = null;
      }
      if (L == null && rec.liveLiquidity != null) {
        try {
          L = BigInt(rec.liveLiquidity);
          validated = rec.stateViewValidated === true;
        } catch {
          L = null;
        }
      }
      if (L == null) {
        return {
          poolId,
          owner: rec.owner,
          tickLower: rec.tickLower,
          tickUpper: rec.tickUpper,
          salt: rec.salt,
          classification: rec.classification,
          liquidity: "0",
          active: false,
          amount0Raw: "0",
          amount1Raw: "0",
          valuationComplete: false,
          incompleteReasons: ["stateview_position_read_failed"],
          stateViewValidated: false,
        };
      }
      return valueSingleHookPosition({
        poolId,
        owner: rec.owner,
        tickLower: rec.tickLower,
        tickUpper: rec.tickUpper,
        salt: rec.salt,
        classification: rec.classification,
        liquidity: L,
        sqrtPriceX96: slot0.sqrtPriceX96,
        tick: slot0.tick,
        currency0: currencies.currency0,
        currency1: currencies.currency1,
        decimals0,
        decimals1,
        price0,
        price1,
        stateViewValidated: validated,
      });
    },
  );

  // Fix active flag: brief wants active = L>0 (not only in-range)
  const normalized = positions.map((p) => {
    let L = ZERO;
    try {
      L = BigInt(p.liquidity);
    } catch {
      L = ZERO;
    }
    return { ...p, active: L > ZERO };
  });

  const hookOwnedActive = normalized.filter(
    (p) => p.classification === "hook_owned" && p.active,
  );
  const hookAmountsOk =
    hookOwnedActive.length > 0 &&
    hookOwnedActive.every((p) => p.valuationComplete);

  if (index.positions.length === 0) incomplete.push("no_positions");

  const softIncomplete = incomplete.filter(
    (r) =>
      r !== "token0_price_unavailable" && r !== "token1_price_unavailable",
  );
  if (
    index.hookDiscoveryComplete &&
    hookAmountsOk &&
    !stale &&
    softIncomplete.length === 0 &&
    price0 != null &&
    price1 != null
  ) {
    terminal = "SUCCESS_COMPLETE";
  } else {
    terminal = "SUCCESS_PARTIAL";
  }

  let summary = aggregateHookValuations({
    poolId,
    positions: normalized,
    index,
    valuedAtBlock: tip ?? undefined,
    pricedAt: params.priceBook ? new Date().toISOString() : undefined,
    stale,
    terminalState: terminal,
  });
  summary = finalizeAggregateAmounts(summary, decimals0, decimals1);
  summary.incompleteReasons = uniqReasons([
    ...(summary.incompleteReasons ?? []),
    ...incomplete,
  ] as HookValuationIncompleteReason[]);
  summary.terminalState = terminal;

  // Amounts-complete may be true even when USD pricing is only SUCCESS_PARTIAL.
  summary.hookValuationComplete =
    index.hookDiscoveryComplete && hookAmountsOk;

  return {
    summary,
    publicSummary: toPublicHookValuationSummary(summary),
    positions: normalized,
    currency0: currencies.currency0,
    currency1: currencies.currency1,
    decimals0,
    decimals1,
    sqrtPriceX96: slot0.sqrtPriceX96.toString(),
    tick: slot0.tick,
    valuedAtBlock: tip,
    pricedAt: params.priceBook ? new Date().toISOString() : null,
    stale,
    generation: params.generation ?? index.generation,
    terminalState: terminal,
  };
}

/** Re-apply USD prices onto an existing valuation result (scan-time enrichment). */
export function enrichHookValuationWithPrices(
  result: HookValuationResult,
  book: TokenPriceBook,
  extraUsdPrices?: Record<string, number | null | undefined>,
): HookValuationResult {
  const price0 = usdPriceForAddress(result.currency0, book, extraUsdPrices);
  const price1 = usdPriceForAddress(result.currency1, book, extraUsdPrices);
  const positions = result.positions.map((p) => {
    if (!p.valuationComplete || result.decimals0 == null || result.decimals1 == null) {
      return {
        ...p,
        token0UsdPrice: price0 ?? undefined,
        token1UsdPrice: price1 ?? undefined,
      };
    }
    try {
      const a0 = BigInt(p.amount0Raw);
      const a1 = BigInt(p.amount1Raw);
      const reasons = (p.incompleteReasons ?? []).filter(
        (r) =>
          r !== "token0_price_unavailable" && r !== "token1_price_unavailable",
      );
      if (price0 == null) reasons.push("token0_price_unavailable");
      if (price1 == null) reasons.push("token1_price_unavailable");
      if (price0 == null || price1 == null) {
        return {
          ...p,
          token0UsdPrice: price0 ?? undefined,
          token1UsdPrice: price1 ?? undefined,
          value0Usd: undefined,
          value1Usd: undefined,
          totalValueUsd: undefined,
          incompleteReasons: reasons.length ? reasons : undefined,
        };
      }
      const value0Usd = rawToNumber(a0, result.decimals0) * price0;
      const value1Usd = rawToNumber(a1, result.decimals1) * price1;
      return {
        ...p,
        token0UsdPrice: price0,
        token1UsdPrice: price1,
        value0Usd,
        value1Usd,
        totalValueUsd: value0Usd + value1Usd,
        incompleteReasons: reasons.length ? reasons : undefined,
      };
    } catch {
      return p;
    }
  });

  let summary = aggregateHookValuations({
    poolId: result.summary.poolId,
    positions,
    index: {
      ...({} as HookPositionIndexState),
      poolId: result.summary.poolId,
      hookDiscoveryComplete: result.summary.hookValuationComplete
        ? true
        : !(result.summary.incompleteReasons ?? []).includes("index_incomplete"),
      foreignDiscoveryComplete: result.summary.foreignValuationComplete,
      positions: [],
    } as HookPositionIndexState,
    valuedAtBlock: result.valuedAtBlock ?? undefined,
    pricedAt: new Date().toISOString(),
    stale: result.stale,
    terminalState: result.terminalState,
  });

  // Preserve discovery completeness from original summary flags more carefully
  summary = {
    ...summary,
    hookValuationComplete: result.summary.hookValuationComplete,
    foreignValuationComplete:
      result.summary.foreignValuationComplete &&
      summary.foreignValuationComplete,
    hookOwnedPositionCount: result.summary.hookOwnedPositionCount,
    activeHookOwnedPositionCount: result.summary.activeHookOwnedPositionCount,
    indexedPositionCount: result.summary.indexedPositionCount,
    incompleteReasons: result.summary.incompleteReasons,
  };
  summary = finalizeAggregateAmounts(
    summary,
    result.decimals0,
    result.decimals1,
  );

  // Recompute USD aggregates from enriched positions
  const activeHook = positions.filter(
    (p) => p.classification === "hook_owned" && p.active,
  );
  const hookUsdOk = activeHook.every(
    (p) => p.totalValueUsd != null && Number.isFinite(p.totalValueUsd),
  );
  summary.hookOwnedValueUsd = hookUsdOk
    ? activeHook.reduce((s, p) => s + (p.totalValueUsd ?? 0), 0)
    : undefined;
  summary.priceDataComplete = hookUsdOk;

  const foreignPosm = positions.filter(
    (p) => p.classification === "foreign_posm" && p.active,
  );
  const foreignOther = positions.filter(
    (p) => p.classification === "foreign_other" && p.active,
  );
  summary.foreignPosmValueUsd = foreignPosm.every((p) => p.totalValueUsd != null)
    ? foreignPosm.reduce((s, p) => s + (p.totalValueUsd ?? 0), 0)
    : undefined;
  summary.foreignOtherValueUsd = foreignOther.every((p) => p.totalValueUsd != null)
    ? foreignOther.reduce((s, p) => s + (p.totalValueUsd ?? 0), 0)
    : undefined;
  if (
    summary.foreignPosmValueUsd != null &&
    summary.foreignOtherValueUsd != null
  ) {
    summary.foreignTotalValueUsd =
      summary.foreignPosmValueUsd + summary.foreignOtherValueUsd;
  }
  if (
    summary.hookOwnedValueUsd != null &&
    summary.foreignTotalValueUsd != null
  ) {
    summary.reconstructedPoolValueUsd =
      summary.hookOwnedValueUsd + summary.foreignTotalValueUsd;
  }

  return {
    ...result,
    positions,
    summary,
    publicSummary: toPublicHookValuationSummary(summary),
    pricedAt: new Date().toISOString(),
  };
}

const ERC20_DECIMALS_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

export function createHookValuationPort(
  client: PublicClient,
  opts?: { stateView?: Address },
): HookValuationPort {
  const stateView = opts?.stateView ?? (STATE_VIEW_ADDRESS as Address);

  return {
    async getBlockNumber() {
      return Number(await client.getBlockNumber());
    },
    async getSlot0(poolId) {
      try {
        const slot0 = await client.readContract({
          address: stateView,
          abi: stateViewAbi,
          functionName: "getSlot0",
          args: [normalizeBytes32(poolId)],
        });
        return {
          sqrtPriceX96: slot0[0] as bigint,
          tick: Number(slot0[1]),
        };
      } catch {
        return null;
      }
    },
    async getPositionLiquidity({ poolId, owner, tickLower, tickUpper, salt }) {
      try {
        const result = await client.readContract({
          address: stateView,
          abi: STATE_VIEW_POSITION_ABI,
          functionName: "getPositionInfo",
          args: [
            normalizeBytes32(poolId),
            getAddress(owner) as Address,
            tickLower,
            tickUpper,
            normalizeBytes32(salt),
          ],
        });
        return (result as readonly [bigint, bigint, bigint])[0];
      } catch {
        return null;
      }
    },
    async getErc20Decimals(address) {
      try {
        const d = await client.readContract({
          address: getAddress(address) as Address,
          abi: ERC20_DECIMALS_ABI,
          functionName: "decimals",
        });
        return Number(d);
      } catch {
        return null;
      }
    },
  };
}
