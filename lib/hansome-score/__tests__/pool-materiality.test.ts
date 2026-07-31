import { describe, expect, it } from "vitest";
import {
  classifyPoolInventoryMateriality,
  isMaterialPoolInventory,
  isPresentationMaterial,
  MIN_MATERIAL_POOL_TOKEN_BALANCE,
  MIN_MATERIAL_POOL_USD,
} from "@/lib/hansome-score/lp/pool-materiality";

describe("classifyPoolInventoryMateriality", () => {
  it("treats null / failed inventory as inventory_unknown (not auto-material)", () => {
    expect(classifyPoolInventoryMateriality({ tokenBalance: null })).toBe(
      "inventory_unknown",
    );
    expect(
      classifyPoolInventoryMateriality({
        tokenBalance: null,
        quoteBalance: null,
      }),
    ).toBe("inventory_unknown");
  });

  it("filters zero and 1-wei dust on scanned token", () => {
    expect(classifyPoolInventoryMateriality({ tokenBalance: 0n })).toBe("dust");
    expect(classifyPoolInventoryMateriality({ tokenBalance: 1n })).toBe("dust");
    expect(
      classifyPoolInventoryMateriality({
        tokenBalance: MIN_MATERIAL_POOL_TOKEN_BALANCE - 1n,
      }),
    ).toBe("dust");
  });

  it("keeps material inventory at/above the generic floor", () => {
    expect(
      classifyPoolInventoryMateriality({
        tokenBalance: MIN_MATERIAL_POOL_TOKEN_BALANCE,
      }),
    ).toBe("material");
    expect(
      classifyPoolInventoryMateriality({
        tokenBalance: 70_360_000n * 10n ** 18n,
      }),
    ).toBe("material");
  });

  it("FOX-like: material FOX/WETH + 1-wei FOX/USDG both sides", () => {
    const main = classifyPoolInventoryMateriality({
      tokenBalance: 69698871398667624951837075n,
      quoteBalance: 10n ** 18n,
    });
    const dust = classifyPoolInventoryMateriality({
      tokenBalance: 1n,
      quoteBalance: 1n,
    });
    expect(main).toBe("material");
    expect(dust).toBe("dust");
    expect(isPresentationMaterial(main)).toBe(true);
    expect(isPresentationMaterial(dust)).toBe(false);
  });

  it("promotes via quote-side material inventory when token side is unread", () => {
    expect(
      classifyPoolInventoryMateriality({
        tokenBalance: null,
        quoteBalance: MIN_MATERIAL_POOL_TOKEN_BALANCE,
      }),
    ).toBe("material");
  });

  it("quote-side dust alone does not prove material or dust for unread token", () => {
    expect(
      classifyPoolInventoryMateriality({
        tokenBalance: null,
        quoteBalance: 1n,
      }),
    ).toBe("inventory_unknown");
  });

  it("uses reliable USD when available (never raw L)", () => {
    expect(
      classifyPoolInventoryMateriality({
        tokenBalance: null,
        quoteBalance: null,
        liquidityUsd: MIN_MATERIAL_POOL_USD,
      }),
    ).toBe("material");
    expect(
      classifyPoolInventoryMateriality({
        tokenBalance: 1n,
        quoteBalance: 1n,
        liquidityUsd: 0.5,
      }),
    ).toBe("dust");
  });
});

describe("isMaterialPoolInventory", () => {
  it("null balance is NOT material (fixes prior auto-keep bypass)", () => {
    expect(isMaterialPoolInventory(null)).toBe(false);
  });

  it("filters zero and 1-wei dust", () => {
    expect(isMaterialPoolInventory(0n)).toBe(false);
    expect(isMaterialPoolInventory(1n)).toBe(false);
    expect(isMaterialPoolInventory(MIN_MATERIAL_POOL_TOKEN_BALANCE - 1n)).toBe(
      false,
    );
  });

  it("keeps material inventory at/above the generic floor", () => {
    expect(isMaterialPoolInventory(MIN_MATERIAL_POOL_TOKEN_BALANCE)).toBe(true);
    expect(isMaterialPoolInventory(70_360_000n * 10n ** 18n)).toBe(true);
  });
});
