import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __drainRelayerWriteLockForTests,
  isNonceTooLowError,
  writeRelayerContract,
} from "@/lib/game/server/testnetRelayerWrite";

describe("isNonceTooLowError", () => {
  it("matches common RPC messages", () => {
    expect(
      isNonceTooLowError(
        new Error(
          "Nonce provided for the transaction is lower than the current nonce of the account.",
        ),
      ),
    ).toBe(true);
    expect(isNonceTooLowError(new Error("nonce too low"))).toBe(true);
    expect(isNonceTooLowError(new Error("NONCE_EXPIRED"))).toBe(true);
    expect(isNonceTooLowError(new Error("execution reverted"))).toBe(false);
  });
});

describe("writeRelayerContract", () => {
  beforeEach(async () => {
    await __drainRelayerWriteLockForTests();
  });

  it("fetches pending nonce before each send and retries on nonce too low", async () => {
    const nonces = [7, 8];
    const publicClient = {
      getTransactionCount: vi.fn(async () => nonces.shift() ?? 8),
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
    };
    const writeContract = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "Nonce provided for the transaction is lower than the current nonce of the account.",
        ),
      )
      .mockResolvedValueOnce("0xabc");

    const hash = await writeRelayerContract({
      publicClient: publicClient as never,
      walletClient: { writeContract, chain: { id: 46630 } } as never,
      account: { address: "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A" } as never,
      address: "0x0000000000000000000000000000000000000001",
      abi: [],
      functionName: "settleDay",
      args: [1n],
    });

    expect(hash).toBe("0xabc");
    expect(publicClient.getTransactionCount).toHaveBeenCalledTimes(2);
    expect(publicClient.getTransactionCount).toHaveBeenCalledWith({
      address: "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A",
      blockTag: "pending",
    });
    expect(writeContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ nonce: 7, functionName: "settleDay" }),
    );
    expect(writeContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ nonce: 8, functionName: "settleDay" }),
    );
  });

  it("serializes concurrent writes so nonces do not collide", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const publicClient = {
      getTransactionCount: vi.fn(async () => 1),
      waitForTransactionReceipt: vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 20));
        inFlight -= 1;
        return { status: "success" };
      }),
    };
    const writeContract = vi.fn(async () => "0xhash");

    await Promise.all([
      writeRelayerContract({
        publicClient: publicClient as never,
        walletClient: { writeContract, chain: null } as never,
        account: { address: "0x1" } as never,
        address: "0x2",
        abi: [],
        functionName: "a",
        args: [],
      }),
      writeRelayerContract({
        publicClient: publicClient as never,
        walletClient: { writeContract, chain: null } as never,
        account: { address: "0x1" } as never,
        address: "0x2",
        abi: [],
        functionName: "b",
        args: [],
      }),
    ]);

    expect(maxInFlight).toBe(1);
    expect(writeContract).toHaveBeenCalledTimes(2);
  });
});
