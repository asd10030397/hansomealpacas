import type { PublicClient } from "viem";

/**
 * Some wallets (MetaMask in particular) run their own EIP-1559 fee prediction
 * on chains they don't have first-class support for, and on Robinhood Chain
 * this has been observed to blow up into a nonsensical estimate (seen: a
 * "Market" gas estimate showing tens of millions of USD, while the network's
 * actual base fee / priority fee were both ~0). See:
 * https://github.com/MetaMask/metamask-extension/issues/23289 and similar
 * reports for other custom/low-traffic EVM chains.
 *
 * Passing explicit `maxFeePerGas` / `maxPriorityFeePerGas` on the transaction
 * request (computed here from the chain's real current gas price) makes the
 * wallet use *our* numbers directly instead of running its own estimation —
 * sidestepping the bug entirely rather than trying to work around it in the
 * wallet UI. Overall cost stays negligible either way (Robinhood Chain gas
 * price is a small fraction of a gwei), so a generous multiplier here is
 * still effectively free while comfortably absorbing base-fee drift between
 * building and mining the transaction.
 */
export async function getSafeGasFees(
  publicClient: PublicClient | undefined,
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | undefined> {
  if (!publicClient) return undefined;

  try {
    const gasPrice = await publicClient.getGasPrice();
    // Robinhood Chain's own eth_maxPriorityFeePerGas reports 0 — validators
    // aren't paid a tip here, only the base fee applies.
    const maxPriorityFeePerGas = 0n;
    // 4x current gas price comfortably covers normal base-fee drift while
    // still being a tiny absolute amount (gas price is sub-gwei).
    const maxFeePerGas = gasPrice * 4n;
    return { maxFeePerGas, maxPriorityFeePerGas };
  } catch (error) {
    console.warn("[gas] getSafeGasFees failed, falling back to wallet defaults:", error);
    return undefined;
  }
}
