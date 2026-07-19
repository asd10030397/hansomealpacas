import {
  BaseError,
  ContractFunctionRevertedError,
  parseEther,
  type Address,
  type PublicClient,
} from "viem";
import { UNIVERSAL_ROUTER_ADDRESS } from "@/lib/chain";
import { universalRouterAbi, v4RouterErrorsAbi } from "@/lib/swap/abis";
import { buildUniversalRouterCalldata } from "@/lib/swap/encoding";

/** Intentionally unreachable min-out so TAKE_ALL / swap min reverts with the real amount. */
const PROBE_AMOUNT_OUT_MIN = 10n ** 30n;

const PROBE_ACCOUNT = "0x0000000000000000000000000000000000000001" as Address;

function extractTooLittleReceived(error: unknown): bigint | null {
  if (!(error instanceof BaseError)) return null;
  const reverted = error.walk(
    (e) => e instanceof ContractFunctionRevertedError,
  ) as ContractFunctionRevertedError | null;
  if (reverted?.data?.errorName === "V4TooLittleReceived") {
    const amountReceived = reverted.data.args?.[1];
    if (typeof amountReceived === "bigint" && amountReceived > 0n) {
      return amountReceived;
    }
  }
  const match = error.message?.match(
    /V4TooLittleReceived\([^)]*?,\s*(\d+)\s*\)/,
  );
  if (match?.[1]) {
    try {
      const n = BigInt(match[1]);
      return n > 0n ? n : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Robinhood has no V4 Quoter. Single-tick math overestimates once a swap
 * crosses concentrated liquidity — probe the Universal Router instead and
 * read the real output from V4TooLittleReceived(amountReceived).
 */
export async function probeSwapAmountOut(input: {
  publicClient: PublicClient;
  direction: "ethToToken" | "tokenToEth";
  amountIn: bigint;
  /** Required for token→ETH (needs the payer's token + Permit2 path). */
  account?: Address;
}): Promise<bigint | null> {
  const { publicClient, direction, amountIn, account } = input;
  if (amountIn <= 0n) return null;

  if (direction === "tokenToEth" && !account) return null;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const calldata = buildUniversalRouterCalldata(
    direction,
    amountIn,
    PROBE_AMOUNT_OUT_MIN,
    deadline,
  );

  const from = direction === "ethToToken" ? PROBE_ACCOUNT : (account as Address);
  const stateOverride =
    direction === "ethToToken"
      ? [{ address: PROBE_ACCOUNT, balance: amountIn + parseEther("0.05") }]
      : undefined;

  try {
    await publicClient.simulateContract({
      address: UNIVERSAL_ROUTER_ADDRESS,
      abi: [...universalRouterAbi, ...v4RouterErrorsAbi],
      functionName: "execute",
      args: [calldata.commands, calldata.inputs, calldata.deadline],
      value: calldata.value,
      account: from,
      ...(stateOverride ? { stateOverride } : {}),
    });
    // Unexpected success with unreachable min-out.
    return null;
  } catch (error) {
    return extractTooLittleReceived(error);
  }
}
