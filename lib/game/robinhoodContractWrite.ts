/**
 * Shared Robinhood write path (Commit / Mint-style).
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
  type Account,
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
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedNetworkFee: bigint;
};

type WriteContractAsync = (params: {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  chainId: number;
  value?: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}) => Promise<Hash>;

export function logRobinhoodWrite(
  label: string,
  prepared: RobinhoodWritePrepared,
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
    simulate: "ok",
    gas: prepared.gas.toString(),
    maxFeePerGas: prepared.maxFeePerGas.toString(),
    maxPriorityFeePerGas: prepared.maxPriorityFeePerGas.toString(),
    estimatedNetworkFeeWei: prepared.estimatedNetworkFee.toString(),
    estimatedNetworkFeeEth: formatEther(prepared.estimatedNetworkFee),
    ...extra,
  });
}

export function formatRobinhoodWriteError(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof BaseError) {
    const reverted = error.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | null;
    if (reverted?.data?.errorName) {
      return `Contract reverted: ${reverted.data.errorName}`;
    }
  }
  if (error instanceof Error) {
    const msg = error.message || error.name;
    const short = msg.split("\n")[0] ?? msg;
    if (/User rejected|denied|rejected the request/i.test(short)) {
      return "Transaction cancelled in wallet.";
    }
    if (
      /Abnormal network fee detected/i.test(short) ||
      /Gas estimation is abnormal/i.test(short)
    ) {
      return ABNORMAL_NETWORK_FEE_MESSAGE;
    }
    const custom = short.match(/\b([A-Z][A-Za-z0-9]+)\b/);
    if (custom && /reverted|Custom/i.test(short)) {
      return `Contract reverted: ${custom[1]}`;
    }
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
      account: request.account as Account,
      value: request.value,
      chain: publicClient.chain,
    });
  } catch (e) {
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
  // Same helper Mint uses (buildSafeMintFees / eth_gasPrice × 4, capped).
  const safeFees = buildSafeMintFees(gasPrice);
  const estimatedNetworkFee = assertSaneMintNetworkFee(gas, safeFees.maxFeePerGas);

  const prepared: RobinhoodWritePrepared = {
    ...request,
    gas,
    maxFeePerGas: safeFees.maxFeePerGas,
    maxPriorityFeePerGas: safeFees.maxPriorityFeePerGas,
    estimatedNetworkFee,
  };
  logRobinhoodWrite(label, prepared, extraLog);

  const hash = await writeContractAsync({
    address: request.address,
    abi: request.abi,
    functionName: request.functionName,
    args: request.args,
    chainId: request.chainId,
    value: request.value,
    maxFeePerGas: prepared.maxFeePerGas,
    maxPriorityFeePerGas: prepared.maxPriorityFeePerGas,
  });

  return { hash, prepared };
}
