import { defineChain, type Address, getAddress, zeroAddress } from "viem";

export const ROBINHOOD_CHAIN_ID = 4663;

export const DEFAULT_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const DEFAULT_EXPLORER = "https://robinhoodchain.blockscout.com";

export const UGLY_TOKEN_ADDRESS = getAddress(
  (process.env.NEXT_PUBLIC_CONTRACT ??
    "0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c") as Address,
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

export const POOL_ID =
  "0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056" as const;

export const POOL_FEE = 500;
export const POOL_TICK_SPACING = 60;
export const UGLY_DECIMALS = 18;

export const POOL_KEY = [
  zeroAddress,
  UGLY_TOKEN_ADDRESS,
  POOL_FEE,
  POOL_TICK_SPACING,
  zeroAddress,
] as const;

export const TOKEN_LIST_URL =
  process.env.NEXT_PUBLIC_TOKEN_LIST ??
  "https://kairu.lol/token-list/ugly-deer-robinhood.tokenlist.json";

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

export function getExplorerAddressUrl(address: string): string {
  const base = robinhoodChain.blockExplorers.default.url.replace(/\/$/, "");
  return `${base}/address/${address}`;
}

export function getExplorerTxUrl(txHash: string): string {
  const base = robinhoodChain.blockExplorers.default.url.replace(/\/$/, "");
  return `${base}/tx/${txHash}`;
}

export function getUglyLogoAbsoluteUrl(origin?: string): string {
  const base = (origin ?? process.env.NEXT_PUBLIC_WEBSITE ?? "https://kairu.lol").replace(
    /\/$/,
    "",
  );
  return `${base}/logo/logo-512.png`;
}
