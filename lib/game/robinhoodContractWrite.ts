/**
 * Shared Robinhood write path for every game transaction.
 *
 * MetaMask's EIP-1559 feeHistory prediction on Robinhood invents absurd
 * "Market" fees (thousands of ETH). Pin maxFeePerGas from eth_gasPrice and
 * never open the wallet until simulate + estimate + fee sanity pass.
 */

import {
  BaseError,
  ContractFunctionRevertedError,
  formatEther,
  type Abi,
  type Address,
  type Hash,
} from "viem";
import type { PublicClient } from "viem";
import {
  ABNORMAL_NETWORK_FEE_MESSAGE,
  assertSaneMintNetworkFee,
  buildSafeMintFees,
} from "@/lib/game/mintTx";

export type RobinhoodWriteRequest = {
  chainId: number;
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  account: Address;
  value?: bigint;
};

export type RobinhoodWritePrepared = RobinhoodWriteRequest & {
  gas: bigint;
  gasPrice: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedNetworkFee: bigint;
};

export type RobinhoodWalletRequest = {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  chainId: number;
  value?: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

type WriteContractAsync = (params: RobinhoodWalletRequest) => Promise<Hash>;

export function logRobinhoodWrite(
  label: string,
  prepared: RobinhoodWritePrepared,
  walletRequest: RobinhoodWalletRequest,
  extra?: Record<string, unknown>,
): void {
  if (typeof console === "undefined") return;
  console.info(`[${label}] prepared request`, {
    chainId: prepared.chainId,
    contract: prepared.address,
    functionName: prepared.functionName,
    args: prepared.args.map((a) => (typeof a === "bigint" ? a.toString() : a)),
    account: prepared.account,
    valueWei: prepared.value?.toString() ?? "0",
    simulateResult: "ok",
    estimateGasResult: prepared.gas.toString(),
    gasPrice: prepared.gasPrice.toString(),
    maxFeePerGas: prepared.maxFeePerGas.toString(),
    maxPriorityFeePerGas: prepared.maxPriorityFeePerGas.toString(),
    estimatedNetworkFeeWei: prepared.estimatedNetworkFee.toString(),
    estimatedNetworkFeeEth: formatEther(prepared.estimatedNetworkFee),
    finalTransactionRequest: {
      address: walletRequest.address,
      functionName: walletRequest.functionName,
      chainId: walletRequest.chainId,
      value: walletRequest.value?.toString() ?? "0",
      maxFeePerGas: walletRequest.maxFeePerGas.toString(),
      maxPriorityFeePerGas: walletRequest.maxPriorityFeePerGas.toString(),
      // Explicitly absent — must never be sent (avoids MetaMask feeHistory path).
      gasFieldOmitted: true,
      gasLimitFieldOmitted: true,
    },
    ...extra,
  });
}

const REVERT_HINTS: Record<string, string> = {
  TokenNotRevealed:
    "TokenNotRevealed — Genesis sale NFT is not collection-revealed on-chain yet (UI artwork ≠ gameplay unlock).",
  InvalidSide:
    "InvalidSide — token has no on-chain Alpaca/Cougar identity (collection reveal incomplete).",
  WrongPhase: "WrongPhase — not in the required day phase for this action.",
  AlreadyCommitted: "AlreadyCommitted — this token already committed for this day.",
  NotAuthorized: "NotAuthorized — wallet is not the token owner/operator.",
  SafeMode: "SafeMode — treasury below safe threshold; commits paused.",
  CommitGloballyPaused: "CommitGloballyPaused — owner paused commits.",
  NotCommitted: "NotCommitted — commit this token before reveal.",
  BadCommitHash: "BadCommitHash — location/salt does not match the commit hash.",
  IllegalLocation: "IllegalLocation — that location is illegal for this side.",
  AlreadySettled: "AlreadySettled — this day was already settled.",
  SeedMissing: "Waiting for settlement randomness.",
  V4TooLittleReceived:
    "V4TooLittleReceived — output below minimum (price moved or quote was stale). Try a smaller size or higher slippage.",
  V4TooMuchRequested:
    "V4TooMuchRequested — input exceeded the settle cap. Reduce the amount and try again.",
};

const REVERT_SIGNATURE_HINTS: Record<string, string> = {
  "0x8b063d73": REVERT_HINTS.V4TooLittleReceived,
  "0x12bacdd3": REVERT_HINTS.V4TooMuchRequested,
};

function extractCustomErrorName(text: string): string | null {
  const patterns = [
    /Error:\s*([A-Z][A-Za-z0-9]+)\s*\(/,
    /reverted with custom error ['"]([A-Z][A-Za-z0-9]+)['"]/i,
    /\b([A-Z][A-Za-z0-9]+)\(\)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const name = m[1];
    // Ignore generic viem/English words that are not Solidity custom errors.
    if (
      name === "Contract" ||
      name === "The" ||
      name === "Error" ||
      name === "Execution" ||
      name === "Transaction"
    ) {
      continue;
    }
    return name;
  }
  return null;
}

function extractRevertSignature(text: string): string | null {
  const m = text.match(/signature:\s*\n?\s*(0x[0-9a-f]{8})\b/i);
  return m?.[1]?.toLowerCase() ?? null;
}

export function formatRobinhoodWriteError(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof BaseError) {
    const reverted = error.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | null;
    const errorName = reverted?.data?.errorName;
    if (errorName) {
      return REVERT_HINTS[errorName] ?? `Contract reverted: ${errorName}`;
    }
    const fromMsg = extractCustomErrorName(error.message);
    if (fromMsg) {
      return REVERT_HINTS[fromMsg] ?? `Contract reverted: ${fromMsg}`;
    }
    const sig = extractRevertSignature(error.message);
    if (sig && REVERT_SIGNATURE_HINTS[sig]) {
      return REVERT_SIGNATURE_HINTS[sig];
    }
    if (sig) {
      return `Contract reverted with signature ${sig}.`;
    }
  }
  if (error instanceof Error) {
    const msg = error.message || error.name;
    if (/User rejected|denied|rejected the request/i.test(msg)) {
      return "Transaction cancelled in wallet.";
    }
    if (
      /Abnormal network fee detected/i.test(msg) ||
      /Gas estimation is abnormal/i.test(msg)
    ) {
      return ABNORMAL_NETWORK_FEE_MESSAGE;
    }
    const custom = extractCustomErrorName(msg);
    if (custom) {
      return REVERT_HINTS[custom] ?? `Contract reverted: ${custom}`;
    }
    const sig = extractRevertSignature(msg);
    if (sig && REVERT_SIGNATURE_HINTS[sig]) {
      return REVERT_SIGNATURE_HINTS[sig];
    }
    if (sig) {
      return `Contract reverted with signature ${sig}.`;
    }
    const short = msg.split("\n")[0] ?? msg;
    return short.length > 220 ? `${short.slice(0, 220)}…` : short;
  }
  return fallback;
}

/**
 * simulate → estimateGas → pin fees from eth_gasPrice → sanity gate → write.
 * Intentionally omits gas/gasLimit so MetaMask uses our EIP-1559 caps only.
 */
export async function sendRobinhoodContractWrite(input: {
  label: string;
  publicClient: PublicClient;
  writeContractAsync: WriteContractAsync;
  request: RobinhoodWriteRequest;
  extraLog?: Record<string, unknown>;
}): Promise<{ hash: Hash; prepared: RobinhoodWritePrepared }> {
  const { publicClient, writeContractAsync, request, label, extraLog } = input;

  try {
    await publicClient.simulateContract({
      address: request.address,
      abi: request.abi,
      functionName: request.functionName,
      args: request.args as never,
      account: request.account,
      value: request.value,
      chain: publicClient.chain,
    });
  } catch (e) {
    // Must not open MetaMask — abort before estimate / write.
    throw new Error(formatRobinhoodWriteError(e, "Simulation failed."));
  }

  const gas = await publicClient.estimateContractGas({
    address: request.address,
    abi: request.abi,
    functionName: request.functionName,
    args: request.args as never,
    account: request.account,
    value: request.value,
  });

  const gasPrice = await publicClient.getGasPrice();
  const safeFees = buildSafeMintFees(gasPrice);
  const estimatedNetworkFee = assertSaneMintNetworkFee(gas, safeFees.maxFeePerGas);

  const prepared: RobinhoodWritePrepared = {
    ...request,
    gas,
    gasPrice,
    maxFeePerGas: safeFees.maxFeePerGas,
    maxPriorityFeePerGas: safeFees.maxPriorityFeePerGas,
    estimatedNetworkFee,
  };

  const walletRequest: RobinhoodWalletRequest = {
    address: request.address,
    abi: request.abi,
    functionName: request.functionName,
    args: request.args,
    chainId: request.chainId,
    value: request.value,
    maxFeePerGas: prepared.maxFeePerGas,
    maxPriorityFeePerGas: prepared.maxPriorityFeePerGas,
  };

  logRobinhoodWrite(label, prepared, walletRequest, extraLog);

  const hash = await writeContractAsync(walletRequest);

  return { hash, prepared };
}
