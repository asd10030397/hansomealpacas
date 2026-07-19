import { describe, expect, it, vi } from "vitest";
import { parseEther } from "viem";
import {
  ABNORMAL_NETWORK_FEE_MESSAGE,
  assertSaneMintNetworkFee,
  buildSafeMintFees,
  getSafeGasFees,
} from "@/lib/swap/gas";

describe("swap Robinhood gas fees", () => {
  it("pins maxFeePerGas from eth_gasPrice with zero priority tip", async () => {
    const publicClient = {
      getGasPrice: vi.fn(async () => 10_000_000n),
    };
    const fees = await getSafeGasFees(publicClient as never);
    expect(fees.maxFeePerGas).toBe(40_000_000n);
    expect(fees.maxPriorityFeePerGas).toBe(0n);
  });

  it("never returns undefined on RPC failure (would reopen MetaMask feeHistory bug)", async () => {
    const publicClient = {
      getGasPrice: vi.fn(async () => {
        throw new Error("rpc down");
      }),
    };
    await expect(getSafeGasFees(publicClient as never)).rejects.toThrow();
    await expect(getSafeGasFees(undefined)).rejects.toThrow(/RPC client unavailable/);
  });

  it("rejects MetaMask-style absurd network fee products before wallet open", () => {
    const fees = buildSafeMintFees(10_000_000n);
    const networkFee = assertSaneMintNetworkFee(500_000n, fees.maxFeePerGas);
    expect(networkFee).toBeLessThan(parseEther("0.01"));

    expect(() =>
      assertSaneMintNetworkFee(500_000n, parseEther("0.05")),
    ).toThrow(ABNORMAL_NETWORK_FEE_MESSAGE);
  });
});
