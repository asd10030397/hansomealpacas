import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import {
  assertMintValueMatches,
  assertSaneMintGasEstimate,
  assertSaneMintNetworkFee,
  buildSafeMintFees,
  computeMintValue,
  MINT_MAX_FEE_PER_GAS_WEI,
  MINT_MAX_NETWORK_FEE_WEI,
} from "@/lib/game/mintTx";

describe("mint value math", () => {
  it("computes mintPrice × quantity in wei exactly once", () => {
    const price = parseEther("0.001");
    expect(computeMintValue(price, 1)).toBe(1_000_000_000_000_000n);
    expect(computeMintValue(price, 5)).toBe(5_000_000_000_000_000n);
  });

  it("does not double-scale ETH decimals", () => {
    const price = 1_000_000_000_000_000n; // already wei
    const value = computeMintValue(price, 1);
    expect(value).toBe(price);
    expect(value).not.toBe(parseEther("1000000000000000"));
  });

  it("rejects mismatched msg.value", () => {
    const price = parseEther("0.001");
    expect(() => assertMintValueMatches(parseEther("1"), price, 1)).toThrow(
      /msg\.value mismatch/,
    );
    expect(() => assertMintValueMatches(price, price, 1)).not.toThrow();
  });
});

describe("safe mint fees (Robinhood MetaMask workaround)", () => {
  it("builds fees from gasPrice without exploding into thousands of ETH", () => {
    // Live Robinhood Testnet eth_gasPrice ≈ 0.01 gwei
    const gasPrice = 10_000_000n;
    const fees = buildSafeMintFees(gasPrice);
    expect(fees.maxPriorityFeePerGas).toBe(0n);
    expect(fees.maxFeePerGas).toBe(40_000_000n);
    expect(fees.maxFeePerGas).toBeLessThanOrEqual(MINT_MAX_FEE_PER_GAS_WEI);

    const gas = 250_000n;
    const networkFee = assertSaneMintNetworkFee(gas, fees.maxFeePerGas);
    // ~0.00001 ETH — never multi-thousand ETH
    expect(networkFee).toBeLessThan(parseEther("0.001"));
    expect(networkFee).toBeLessThan(MINT_MAX_NETWORK_FEE_WEI);
  });

  it("blocks a 0.001 ETH mint from carrying a multi-thousand-ETH network fee", () => {
    const gas = 250_000n;
    // Simulate MetaMask-style absurd maxFeePerGas
    const absurdMaxFee = parseEther("0.015"); // per gas unit → huge total
    expect(() => assertSaneMintNetworkFee(gas, absurdMaxFee)).toThrow(
      /Gas estimation is abnormal/,
    );
  });

  it("rejects zero / huge gas estimates", () => {
    expect(() => assertSaneMintGasEstimate(0n)).toThrow(/abnormal/);
    expect(() => assertSaneMintGasEstimate(50_000_000n)).toThrow(/abnormal/);
    expect(() => assertSaneMintGasEstimate(210_000n)).not.toThrow();
  });

  it("caps maxFeePerGas at 1 gwei", () => {
    const fees = buildSafeMintFees(parseEther("0.000000002")); // 2 gwei
    expect(fees.maxFeePerGas).toBe(MINT_MAX_FEE_PER_GAS_WEI);
  });
});
