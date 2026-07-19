import { describe, expect, it } from "vitest";
import { applySlippage, formatSwapAmountDisplay } from "@/lib/swap/quote";

describe("formatSwapAmountDisplay", () => {
  it("trims long fractional HANSOME amounts for the receive row", () => {
    expect(formatSwapAmountDisplay("30855511.681311010526634906")).toBe("30855511.6813");
  });

  it("strips trailing zeros after trim", () => {
    expect(formatSwapAmountDisplay("1.250000")).toBe("1.25");
  });

  it("keeps integers unchanged", () => {
    expect(formatSwapAmountDisplay("42")).toBe("42");
  });
});

describe("applySlippage", () => {
  it("applies 0.50% (50 bps) haircut", () => {
    expect(applySlippage(10_000n, 50)).toBe(9_950n);
  });
});
