/**
 * Canonical Robinhood Chain Mainnet endpoints.
 * Shared by hardhat.config + deploy ceremony guards.
 * Never allow Testnet (46630).
 */

export const ROBINHOOD_MAINNET_CHAIN_ID = 4663;
export const ROBINHOOD_TESTNET_CHAIN_ID = 46630;
export const ROBINHOOD_MAINNET_RPC_URL =
  "https://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_MAINNET_RPC_HOST = "rpc.mainnet.chain.robinhood.com";

/** Validate / normalize RH_RPC_URL for Mainnet networks. Throws on Testnet or host mismatch. */
export function resolveRobinhoodMainnetRpcUrl(
  rhRpcUrl: string | undefined,
): string {
  const url = (rhRpcUrl?.trim() || ROBINHOOD_MAINNET_RPC_URL).trim();
  const lower = url.toLowerCase();
  if (lower.includes("testnet") || lower.includes("46630")) {
    throw new Error(
      `REFUSED: RH_RPC_URL looks like Robinhood Testnet. ` +
        `Mainnet requires ${ROBINHOOD_MAINNET_RPC_URL} (chainId ${ROBINHOOD_MAINNET_CHAIN_ID}). Got: ${url}`,
    );
  }
  if (!lower.includes(ROBINHOOD_MAINNET_RPC_HOST)) {
    throw new Error(
      `REFUSED: RH_RPC_URL host mismatch. ` +
        `Expected host ${ROBINHOOD_MAINNET_RPC_HOST} (chainId ${ROBINHOOD_MAINNET_CHAIN_ID}). Got: ${url}`,
    );
  }
  return url;
}
