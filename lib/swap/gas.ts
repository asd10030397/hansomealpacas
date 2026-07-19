/**
 * Swap fee helpers — same Robinhood pipeline as game txs.
 *
 * MetaMask's EIP-1559 feeHistory prediction on Robinhood invents absurd
 * "Market" fees (tens of thousands of ETH). Never omit maxFeePerGas /
 * maxPriorityFeePerGas, and never fall back to wallet fee estimation.
 *
 * Prefer `sendRobinhoodContractWrite` for every Swap write (approve / Permit2 /
 * Universal Router execute). This module re-exports the shared fee guards.
 */

import type { PublicClient } from "viem";
import {
  ABNORMAL_NETWORK_FEE_MESSAGE,
  assertSaneMintNetworkFee,
  buildSafeMintFees,
} from "@/lib/game/mintTx";

export {
  ABNORMAL_NETWORK_FEE_MESSAGE,
  assertSaneMintNetworkFee,
  buildSafeMintFees,
};

/**
 * Pin EIP-1559 caps from eth_gasPrice only.
 * Throws on failure — never returns undefined (undefined = MetaMask feeHistory bug).
 */
export async function getSafeGasFees(
  publicClient: PublicClient | undefined,
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  if (!publicClient) {
    throw new Error("RPC client unavailable — cannot pin Robinhood gas fees.");
  }
  const gasPrice = await publicClient.getGasPrice();
  return buildSafeMintFees(gasPrice);
}
