/**
 * Genesis mint transaction helpers — value math, fee guards, request shape.
 * Keeps MetaMask from using broken EIP-1559 fee prediction on Robinhood.
 */

import { formatEther, parseEther } from "viem";
import {
  GENESIS_CHAIN_ID,
  GENESIS_NFT_ADDRESS,
  GENESIS_SUPPLY,
} from "@/lib/game/genesis";
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";

/** Hard cap on per-gas fee we ever attach (1 gwei). */
export const MINT_MAX_FEE_PER_GAS_WEI = 1_000_000_000n;

/** Reject if network fee alone would exceed this (testnet-safe). */
export const MINT_MAX_NETWORK_FEE_WEI = parseEther("0.05");

/** Gas units above this are treated as malformed estimates. */
export const MINT_MAX_GAS_UNITS = 2_000_000n;

/** Gas units at or below zero are invalid. */
export const MINT_MIN_GAS_UNITS = 21_000n;

export type MintKind = "publicMint" | "whitelistMint";

export type PreparedMintRequest = {
  chainId: number;
  address: `0x${string}`;
  functionName: MintKind;
  args: readonly unknown[];
  value: bigint;
  quantity: number;
  mintPrice: bigint;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedNetworkFee: bigint;
};

export function computeMintValue(mintPrice: bigint, quantity: number): bigint {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Mint quantity must be a positive integer.");
  }
  if (quantity > GENESIS_SUPPLY.publicWalletMax) {
    throw new Error(`Mint quantity exceeds wallet max (${GENESIS_SUPPLY.publicWalletMax}).`);
  }
  if (mintPrice < 0n) {
    throw new Error("Mint price cannot be negative.");
  }
  return mintPrice * BigInt(quantity);
}

export function assertMintValueMatches(
  value: bigint,
  mintPrice: bigint,
  quantity: number,
): void {
  const expected = computeMintValue(mintPrice, quantity);
  if (value !== expected) {
    throw new Error(
      `msg.value mismatch: got ${value.toString()} wei, expected ${expected.toString()} wei ` +
        `(${formatEther(mintPrice)} ETH × ${quantity}).`,
    );
  }
}

export function isRobinhoodChainId(chainId: number): boolean {
  return chainId === ROBINHOOD_CHAIN_ID || chainId === ROBINHOOD_TESTNET_CHAIN_ID;
}

/**
 * Build EIP-1559 fees from the chain's real eth_gasPrice.
 * MetaMask's own feeHistory prediction on Robinhood is known to explode
 * into multi-thousand-ETH "Market" estimates — do not rely on it here.
 */
export function buildSafeMintFees(gasPrice: bigint): {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
} {
  if (gasPrice <= 0n) {
    throw new Error("Network gas price is zero or unavailable.");
  }
  // Cover base-fee drift; absolute cost stays tiny on Robinhood (~0.01 gwei).
  let maxFeePerGas = gasPrice * 4n;
  if (maxFeePerGas > MINT_MAX_FEE_PER_GAS_WEI) {
    maxFeePerGas = MINT_MAX_FEE_PER_GAS_WEI;
  }
  return { maxFeePerGas, maxPriorityFeePerGas: 0n };
}

export function assertSaneMintGasEstimate(gas: bigint): void {
  if (gas < MINT_MIN_GAS_UNITS) {
    throw new Error("Gas estimation is abnormal. Transaction was not submitted.");
  }
  if (gas > MINT_MAX_GAS_UNITS) {
    throw new Error("Gas estimation is abnormal. Transaction was not submitted.");
  }
}

export function assertSaneMintNetworkFee(
  gas: bigint,
  maxFeePerGas: bigint,
): bigint {
  assertSaneMintGasEstimate(gas);
  if (maxFeePerGas <= 0n || maxFeePerGas > MINT_MAX_FEE_PER_GAS_WEI) {
    throw new Error("Gas estimation is abnormal. Transaction was not submitted.");
  }
  const estimatedNetworkFee = gas * maxFeePerGas;
  if (estimatedNetworkFee <= 0n || estimatedNetworkFee > MINT_MAX_NETWORK_FEE_WEI) {
    throw new Error("Gas estimation is abnormal. Transaction was not submitted.");
  }
  return estimatedNetworkFee;
}

export function assertMintEnvironment(input: {
  walletChainId: number | undefined;
  contractAddress: `0x${string}` | null;
}): asserts input is {
  walletChainId: number;
  contractAddress: `0x${string}`;
} {
  if (input.walletChainId !== GENESIS_CHAIN_ID) {
    throw new Error(
      `Wrong network. Connect to chain ${GENESIS_CHAIN_ID} (Robinhood Testnet).`,
    );
  }
  if (!input.contractAddress || input.contractAddress !== GENESIS_NFT_ADDRESS) {
    throw new Error("Genesis NFT contract address does not match this environment.");
  }
}

export function logMintRequest(req: PreparedMintRequest, wallet: string | undefined): void {
  if (typeof console === "undefined") return;
  console.info("[genesis-mint] prepared request", {
    chainId: req.chainId,
    wallet,
    contract: req.address,
    functionName: req.functionName,
    args: req.args,
    quantity: req.quantity,
    mintPriceWei: req.mintPrice.toString(),
    mintPriceEth: formatEther(req.mintPrice),
    valueWei: req.value.toString(),
    valueEth: formatEther(req.value),
    gas: req.gas.toString(),
    maxFeePerGas: req.maxFeePerGas.toString(),
    maxPriorityFeePerGas: req.maxPriorityFeePerGas.toString(),
    estimatedNetworkFeeWei: req.estimatedNetworkFee.toString(),
    estimatedNetworkFeeEth: formatEther(req.estimatedNetworkFee),
  });
}

/** Decode common viem/wagmi contract errors for the mint UI. */
export function formatMintError(error: unknown): string {
  if (!error) return "Mint failed.";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const msg = error.message || error.name;
    const short = msg.split("\n")[0] ?? msg;
    if (/User rejected|denied|rejected the request/i.test(short)) {
      return "Transaction cancelled in wallet.";
    }
    if (/Gas estimation is abnormal/i.test(short)) {
      return short;
    }
    // Prefer custom error names when present in the message.
    const custom = short.match(/\b([A-Z][A-Za-z0-9]+)\b/);
    if (custom && /reverted|Custom/i.test(short)) {
      return `Contract reverted: ${custom[1]}`;
    }
    return short.length > 220 ? `${short.slice(0, 220)}…` : short;
  }
  return "Mint failed.";
}

export function isRobinhoodFeeOverrideRequired(chainId: number): boolean {
  return isRobinhoodChainId(chainId);
}
