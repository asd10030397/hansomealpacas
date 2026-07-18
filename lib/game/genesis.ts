import { getAddress, type Address, isAddress } from "viem";
import { robinhoodTestnetChain } from "@/lib/chain";

/** Genesis mint targets Robinhood Chain testnet until mainnet deploy. */
export const GENESIS_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_GAME_CHAIN_ID ?? robinhoodTestnetChain.id,
);

export const GENESIS_RPC_URL =
  process.env.NEXT_PUBLIC_GAME_RPC_URL?.trim() ||
  robinhoodTestnetChain.rpcUrls.default.http[0];

export const GENESIS_EXPLORER =
  process.env.NEXT_PUBLIC_GAME_EXPLORER?.trim() ||
  robinhoodTestnetChain.blockExplorers.default.url;

const rawAddress = process.env.NEXT_PUBLIC_GENESIS_NFT_ADDRESS?.trim() ?? "";

/** Deployed HansomeGenesisNFT — empty until env / deployment is set. */
export const GENESIS_NFT_ADDRESS: Address | null =
  rawAddress && isAddress(rawAddress) ? getAddress(rawAddress) : null;

export const GENESIS_COLLECTION_NAME = "HANSOME Genesis NFT";

export const GENESIS_SUPPLY = {
  total: 550,
  alpaca: 500,
  cougar: 50,
  reserved: 10,
  whitelist: 100,
  public: 440,
  wlWalletMax: 1,
  publicWalletMax: 5,
  combinedWalletMax: 6,
  royaltyBps: 500,
} as const;

export function getGenesisExplorerAddressUrl(address: string): string {
  const base = GENESIS_EXPLORER.replace(/\/$/, "");
  return `${base}/address/${address}`;
}

export function getGenesisExplorerTxUrl(txHash: string): string {
  const base = GENESIS_EXPLORER.replace(/\/$/, "");
  return `${base}/tx/${txHash}`;
}

export function isGenesisConfigured(): boolean {
  return GENESIS_NFT_ADDRESS != null;
}
