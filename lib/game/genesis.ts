import type { Address } from "viem";
import { robinhoodTestnetChain } from "@/lib/chain";
import {
  GENESIS_ADDRESS_ENV_KEYS,
  resolveGenesisNftAddress,
  resolveOptionalConfiguredAddress,
} from "@/lib/game/contractAddresses";

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

/**
 * Deployed HansomeGenesisNFT — env only
 * (NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS or NEXT_PUBLIC_GENESIS_NFT_ADDRESS).
 * No silent Testnet default.
 */
export const GENESIS_NFT_ADDRESS: Address | null =
  resolveOptionalConfiguredAddress(GENESIS_ADDRESS_ENV_KEYS, "Genesis NFT");

export function requireGenesisNftAddress(): Address {
  const r = resolveGenesisNftAddress();
  if (!r.ok) throw new Error(r.error);
  return r.address;
}

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
