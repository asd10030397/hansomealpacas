import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import {
  ABNORMAL_NETWORK_FEE_MESSAGE,
  assertMintValueMatches,
  assertSaneMintGasEstimate,
  assertSaneMintNetworkFee,
  buildSafeMintFees,
  computeMintValue,
  formatMintError,
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
      ABNORMAL_NETWORK_FEE_MESSAGE,
    );
  });

  it("aborts before wallet when estimated fee exceeds 0.01 ETH", () => {
    expect(MINT_MAX_NETWORK_FEE_WEI).toBe(parseEther("0.01"));
    // 250k gas × 50 gwei = 0.0125 ETH > 0.01 ETH
    expect(() => assertSaneMintNetworkFee(250_000n, 50_000_000_000n)).toThrow(
      ABNORMAL_NETWORK_FEE_MESSAGE,
    );
    // 500k × 25 gwei = 0.0125 ETH > 0.01 ETH
    expect(() => assertSaneMintNetworkFee(500_000n, 25_000_000_000n)).toThrow(
      ABNORMAL_NETWORK_FEE_MESSAGE,
    );
    // Sane Robinhood path (~0.00001 ETH) stays under the threshold
    expect(() => assertSaneMintNetworkFee(250_000n, 40_000_000n)).not.toThrow();
  });

  it("surfaces the exact user-facing fee abort message", () => {
    expect(formatMintError(new Error(ABNORMAL_NETWORK_FEE_MESSAGE))).toBe(
      ABNORMAL_NETWORK_FEE_MESSAGE,
    );
    expect(
      formatMintError(new Error("Gas estimation is abnormal. Transaction was not submitted.")),
    ).toBe(ABNORMAL_NETWORK_FEE_MESSAGE);
  });

  it("rejects zero / huge gas estimates", () => {
    expect(() => assertSaneMintGasEstimate(0n)).toThrow(ABNORMAL_NETWORK_FEE_MESSAGE);
    expect(() => assertSaneMintGasEstimate(50_000_000n)).toThrow(
      ABNORMAL_NETWORK_FEE_MESSAGE,
    );
    expect(() => assertSaneMintGasEstimate(210_000n)).not.toThrow();
  });

  it("caps maxFeePerGas at 1 gwei", () => {
    const fees = buildSafeMintFees(parseEther("0.000000002")); // 2 gwei
    expect(fees.maxFeePerGas).toBe(MINT_MAX_FEE_PER_GAS_WEI);
  });
});
