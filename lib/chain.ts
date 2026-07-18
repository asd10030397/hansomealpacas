import { defineChain, type Address, getAddress, zeroAddress } from "viem";

export const ROBINHOOD_CHAIN_ID = 4663;

export const DEFAULT_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const DEFAULT_EXPLORER = "https://robinhoodchain.blockscout.com";

/**
 * HANSOME token contract on Robinhood Chain (deployed + verified mainnet
 * address). Override via NEXT_PUBLIC_CONTRACT if needed.
 */
export const TOKEN_ADDRESS = getAddress(
  (process.env.NEXT_PUBLIC_CONTRACT ?? "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875") as Address,
);

export const UNIVERSAL_ROUTER_ADDRESS = getAddress(
  (process.env.NEXT_PUBLIC_UNIVERSAL_ROUTER ??
    "0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77") as Address,
);

export const PERMIT2_ADDRESS = getAddress(
  (process.env.NEXT_PUBLIC_PERMIT2 ??
    "0x000000000022D473030F116dDEE9F6B43aC78BA3") as Address,
);

export const STATE_VIEW_ADDRESS = getAddress(
  (process.env.NEXT_PUBLIC_STATE_VIEW ??
    "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b") as Address,
);

/**
 * Uniswap v4 pool ID for the official HANSOME/ETH pool on Robinhood Chain.
 */
export const POOL_ID =
  "0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d" as const;

export const POOL_FEE = 500;
export const POOL_TICK_SPACING = 10;
export const TOKEN_DECIMALS = 18;

export const POOL_KEY = [
  zeroAddress,
  TOKEN_ADDRESS,
  POOL_FEE,
  POOL_TICK_SPACING,
  zeroAddress,
] as const;

export const TOKEN_LIST_URL =
  process.env.NEXT_PUBLIC_TOKEN_LIST ??
  "https://hansomealpacas.xyz/token-list/hansome-alpacas-robinhood.tokenlist.json";

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: process.env.NEXT_PUBLIC_EXPLORER?.trim() || DEFAULT_EXPLORER,
    },
  },
});

/** Robinhood Chain testnet — Genesis NFT mint integration target. */
export const ROBINHOOD_TESTNET_CHAIN_ID = 46630;
export const DEFAULT_TESTNET_RPC_URL = "https://rpc.testnet.chain.robinhood.com";
export const DEFAULT_TESTNET_EXPLORER = "https://explorer.testnet.chain.robinhood.com";

export const robinhoodTestnetChain = defineChain({
  id: ROBINHOOD_TESTNET_CHAIN_ID,
  name: "Robinhood Chain Testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_GAME_RPC_URL?.trim() || DEFAULT_TESTNET_RPC_URL,
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url:
        process.env.NEXT_PUBLIC_GAME_EXPLORER?.trim() || DEFAULT_TESTNET_EXPLORER,
    },
  },
  testnet: true,
});

export function getExplorerAddressUrl(address: string): string {
  const base = robinhoodChain.blockExplorers.default.url.replace(/\/$/, "");
  return `${base}/address/${address}`;
}

export function getExplorerTxUrl(txHash: string): string {
  const base = robinhoodChain.blockExplorers.default.url.replace(/\/$/, "");
  return `${base}/tx/${txHash}`;
}

export function getTokenLogo256Url(origin?: string): string {
  const base = (
    origin ??
    process.env.NEXT_PUBLIC_WEBSITE ??
    "https://hansomealpacas.xyz"
  ).replace(/\/$/, "");
  return `${base}/logo/logo-256.png`;
}

