import type { WalletClient } from "viem";
import { getAddress } from "viem";
import { UGLY_DECIMALS, UGLY_TOKEN_ADDRESS } from "@/lib/chain";

/** MetaMask / EIP-747 recommended: 256×256 PNG over HTTPS */
export const UGLY_WALLET_LOGO_URL = "https://kairu.lol/logo/logo-256.png";

export const UGLY_WATCH_ASSET = {
  type: "ERC20" as const,
  options: {
    address: getAddress(UGLY_TOKEN_ADDRESS),
    symbol: "UGLY",
    decimals: UGLY_DECIMALS,
    image: UGLY_WALLET_LOGO_URL,
  },
};

export type WalletWatchAssetRequest = {
  method: "wallet_watchAsset";
  params: typeof UGLY_WATCH_ASSET;
};

export function buildWalletWatchAssetRequest(): WalletWatchAssetRequest {
  return {
    method: "wallet_watchAsset",
    params: UGLY_WATCH_ASSET,
  };
}

/**
 * Calls MetaMask / Rabby EIP-747 `wallet_watchAsset` with UGLY metadata.
 * Logs request + result to console for verification.
 */
export async function requestWatchUglyAsset(walletClient: WalletClient): Promise<boolean> {
  const request = buildWalletWatchAssetRequest();

  console.info("[UGLY] wallet_watchAsset →", JSON.stringify(request, null, 2));

  const added = await walletClient.request({
    method: request.method,
    params: request.params,
  });

  console.info("[UGLY] wallet_watchAsset success:", {
    added,
    image: UGLY_WALLET_LOGO_URL,
    address: UGLY_WATCH_ASSET.options.address,
    symbol: UGLY_WATCH_ASSET.options.symbol,
    decimals: UGLY_WATCH_ASSET.options.decimals,
  });

  return Boolean(added);
}
