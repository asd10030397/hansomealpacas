import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import {
  ABNORMAL_NETWORK_FEE_MESSAGE,
  assertSaneMintNetworkFee,
  buildSafeMintFees,
} from "@/lib/game/mintTx";
import { formatRobinhoodWriteError } from "@/lib/game/robinhoodContractWrite";

describe("robinhood commit/mint fee path", () => {
  it("pins fees from eth_gasPrice like Mint (Commit must use the same helper)", () => {
    const gasPrice = 10_000_000n; // 0.01 gwei-style Robinhood quote
    const fees = buildSafeMintFees(gasPrice);
    expect(fees.maxFeePerGas).toBe(40_000_000n);
    expect(fees.maxPriorityFeePerGas).toBe(0n);

    // Typical commit gas × pinned fee stays far under 0.01 ETH
    const networkFee = assertSaneMintNetworkFee(120_000n, fees.maxFeePerGas);
    expect(networkFee).toBe(120_000n * 40_000_000n);
    expect(networkFee).toBeLessThan(parseEther("0.01"));
  });

  it("rejects MetaMask-style absurd fee products before wallet open", () => {
    expect(() =>
      assertSaneMintNetworkFee(120_000n, parseEther("0.03")),
    ).toThrow(ABNORMAL_NETWORK_FEE_MESSAGE);
  });

  it("surfaces abnormal fee and user-reject copy", () => {
    expect(
      formatRobinhoodWriteError(
        new Error("Abnormal network fee detected. Please try again later."),
        "fallback",
      ),
    ).toBe(ABNORMAL_NETWORK_FEE_MESSAGE);
    expect(
      formatRobinhoodWriteError(new Error("User rejected the request"), "fallback"),
    ).toBe("Transaction cancelled in wallet.");
  });
});
