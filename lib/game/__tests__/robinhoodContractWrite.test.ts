import { describe, expect, it, vi } from "vitest";
import { parseEther } from "viem";
import {
  ABNORMAL_NETWORK_FEE_MESSAGE,
  assertSaneMintNetworkFee,
  buildSafeMintFees,
} from "@/lib/game/mintTx";
import {
  formatRobinhoodWriteError,
  sendRobinhoodContractWrite,
} from "@/lib/game/robinhoodContractWrite";

describe("robinhood commit/mint fee path", () => {
  it("pins fees from eth_gasPrice like Mint (Commit must use the same helper)", () => {
    const gasPrice = 10_000_000n;
    const fees = buildSafeMintFees(gasPrice);
    expect(fees.maxFeePerGas).toBe(40_000_000n);
    expect(fees.maxPriorityFeePerGas).toBe(0n);

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

describe("sendRobinhoodContractWrite pipeline", () => {
  const address = "0x1111111111111111111111111111111111111111" as const;
  const account = "0x2222222222222222222222222222222222222222" as const;

  it("runs simulate → estimate → eth_gasPrice fees → write with fee caps only", async () => {
    const order: string[] = [];
    const publicClient = {
      chain: { id: 46630 },
      simulateContract: vi.fn(async () => {
        order.push("simulate");
        return { result: undefined };
      }),
      estimateContractGas: vi.fn(async () => {
        order.push("estimate");
        return 150_000n;
      }),
      getGasPrice: vi.fn(async () => {
        order.push("gasPrice");
        return 10_000_000n;
      }),
    };

    const writeContractAsync = vi.fn(async (req: Record<string, unknown>) => {
      order.push("write");
      expect(req).toEqual({
        address,
        abi: [],
        functionName: "commit",
        args: [1n],
        chainId: 46630,
        value: undefined,
        maxFeePerGas: 40_000_000n,
        maxPriorityFeePerGas: 0n,
      });
      expect(req).not.toHaveProperty("gas");
      expect(req).not.toHaveProperty("gasLimit");
      return "0xabc" as `0x${string}`;
    });

    const { prepared } = await sendRobinhoodContractWrite({
      label: "test-commit",
      publicClient: publicClient as never,
      writeContractAsync: writeContractAsync as never,
      request: {
        chainId: 46630,
        address,
        abi: [],
        functionName: "commit",
        args: [1n],
        account,
      },
    });

    expect(order).toEqual(["simulate", "estimate", "gasPrice", "write"]);
    expect(prepared.gas).toBe(150_000n);
    expect(prepared.gasPrice).toBe(10_000_000n);
    expect(prepared.maxFeePerGas).toBe(40_000_000n);
    expect(writeContractAsync).toHaveBeenCalledTimes(1);
  });

  it("does not open the wallet when simulateContract reverts", async () => {
    const publicClient = {
      chain: { id: 46630 },
      simulateContract: vi.fn(async () => {
        throw new Error("execution reverted: NotInCommitPhase");
      }),
      estimateContractGas: vi.fn(),
      getGasPrice: vi.fn(),
    };
    const writeContractAsync = vi.fn();

    await expect(
      sendRobinhoodContractWrite({
        label: "test-commit-revert",
        publicClient: publicClient as never,
        writeContractAsync: writeContractAsync as never,
        request: {
          chainId: 46630,
          address,
          abi: [],
          functionName: "commit",
          args: [1n],
          account,
        },
      }),
    ).rejects.toThrow(/NotInCommitPhase|reverted|Simulation failed/i);

    expect(publicClient.estimateContractGas).not.toHaveBeenCalled();
    expect(publicClient.getGasPrice).not.toHaveBeenCalled();
    expect(writeContractAsync).not.toHaveBeenCalled();
  });
});
