import { describe, expect, it, vi } from "vitest";
import { BaseError, ContractFunctionRevertedError, parseEther } from "viem";
import { probeSwapAmountOut } from "@/lib/swap/probeQuote";

describe("probeSwapAmountOut", () => {
  it("returns amountReceived from V4TooLittleReceived", async () => {
    const amountReceived = 30_609_438_179_422_399_031_007_902n;
    const reverted = new ContractFunctionRevertedError({
      abi: [
        {
          type: "error",
          name: "V4TooLittleReceived",
          inputs: [
            { name: "minAmountOutReceived", type: "uint256" },
            { name: "amountReceived", type: "uint256" },
          ],
        },
      ],
      data: "0x8b063d73000000000000000000000000000000000000000c9f2c9cd04674edea400000000000000000000000000000000000000000000000001951ccf7f86ea884b5da9e",
      functionName: "execute",
    } as never);

    const probeError = Object.assign(new BaseError("probe"), {
      walk(fn?: (err: unknown) => boolean) {
        if (fn?.(reverted)) return reverted;
        return null;
      },
    });

    const publicClient = {
      simulateContract: vi.fn(async () => {
        throw probeError;
      }),
    };

    const out = await probeSwapAmountOut({
      publicClient: publicClient as never,
      direction: "ethToToken",
      amountIn: parseEther("0.099"),
    });

    expect(out).toBe(amountReceived);
    expect(publicClient.simulateContract).toHaveBeenCalledOnce();
  });

  it("returns null for token→ETH without an account", async () => {
    const out = await probeSwapAmountOut({
      publicClient: { simulateContract: vi.fn() } as never,
      direction: "tokenToEth",
      amountIn: parseEther("1"),
    });
    expect(out).toBeNull();
  });
});
