/**
 * Generic pool inventory materiality — filters economically negligible pools.
 * Inventory-based (token units in the pool), not token-address hardcoding.
 *
 * Existence of a factory pool/pair ≠ material presentation liquidity.
 * Failed inventory reads are honest `inventory_unknown`, never auto-material.
 */

/** Minimum scanned-token / quote balance (raw wei/units) for material inventory. */
export const MIN_MATERIAL_POOL_TOKEN_BALANCE = 1_000n;

/**
 * Optional USD floor when a reliable per-pool USD is already known.
 * Discovery adapters usually lack this; presentation may pass it later.
 */
export const MIN_MATERIAL_POOL_USD = 1;

export type PoolInventoryMateriality =
  | "material"
  | "dust"
  | "inventory_unknown";

export type PoolInventoryMaterialityInput = {
  /** Scanned token `balanceOf(pool)` — null when the read failed. */
  tokenBalance: bigint | null;
  /** Quote/other-side `balanceOf(pool)` when available — null = unread/failed. */
  quoteBalance?: bigint | null;
  /** Reliable pool USD when available — never invent from raw L. */
  liquidityUsd?: number | null;
};

function isKnownDust(balance: bigint): boolean {
  return balance < MIN_MATERIAL_POOL_TOKEN_BALANCE;
}

function isKnownMaterial(balance: bigint): boolean {
  return balance >= MIN_MATERIAL_POOL_TOKEN_BALANCE;
}

function isMaterialUsd(usd: number | null | undefined): boolean {
  return usd != null && Number.isFinite(usd) && usd >= MIN_MATERIAL_POOL_USD;
}

function isDustUsd(usd: number | null | undefined): boolean {
  return usd != null && Number.isFinite(usd) && usd >= 0 && usd < MIN_MATERIAL_POOL_USD;
}

/**
 * Classify pool inventory for discovery vs presentation.
 *
 * - material: reliably non-negligible inventory (either side) and/or USD
 * - dust: known inventories are below the generic floor (and USD dust if present)
 * - inventory_unknown: cannot prove material or dust (failed/missing reads)
 */
export function classifyPoolInventoryMateriality(
  input: PoolInventoryMaterialityInput,
): PoolInventoryMateriality {
  const { tokenBalance, quoteBalance = null, liquidityUsd = null } = input;

  if (isMaterialUsd(liquidityUsd)) return "material";

  if (tokenBalance != null && isKnownMaterial(tokenBalance)) return "material";
  if (quoteBalance != null && isKnownMaterial(quoteBalance)) return "material";

  const tokenKnown = tokenBalance != null;
  const quoteKnown = quoteBalance != null;

  if (tokenKnown && quoteKnown) {
    if (isKnownDust(tokenBalance) && isKnownDust(quoteBalance)) {
      return isDustUsd(liquidityUsd) || liquidityUsd == null ? "dust" : "material";
    }
  }

  if (tokenKnown && isKnownDust(tokenBalance) && !quoteKnown) {
    // Scanned-token inventory is dust; missing quote does not promote to material.
    return isDustUsd(liquidityUsd) || liquidityUsd == null ? "dust" : "material";
  }

  if (quoteKnown && isKnownDust(quoteBalance) && !tokenKnown) {
    // Quote dust alone cannot prove the scanned token side — stay unknown.
    return "inventory_unknown";
  }

  if (!tokenKnown && !quoteKnown) {
    return "inventory_unknown";
  }

  return "inventory_unknown";
}

/**
 * Whether inventory qualifies as a material presentation pool.
 * `null` balance alone is NOT material (use classify for discovery bookkeeping).
 */
export function isMaterialPoolInventory(balance: bigint | null): boolean {
  return classifyPoolInventoryMateriality({ tokenBalance: balance }) === "material";
}

/** Presentation cards include only reliably material pools by default. */
export function isPresentationMaterial(
  materiality: PoolInventoryMateriality,
): boolean {
  return materiality === "material";
}
