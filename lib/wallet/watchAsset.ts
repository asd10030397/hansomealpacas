import type { WalletClient } from "viem";
import { getAddress } from "viem";
import { PROJECT } from "@/content/project";
import { TOKEN_DECIMALS, TOKEN_ADDRESS, getTokenLogo256Url } from "@/lib/chain";

/** MetaMask / EIP-747 recommended: 256×256 PNG over HTTPS */
export const TOKEN_WALLET_LOGO_URL = getTokenLogo256Url();

export const TOKEN_WATCH_ASSET = {
  type: "ERC20" as const,
  options: {
    address: getAddress(TOKEN_ADDRESS),
    symbol: PROJECT.symbol,
    decimals: TOKEN_DECIMALS,
    image: TOKEN_WALLET_LOGO_URL,
  },
};

export type WalletWatchAssetRequest = {
  method: "wallet_watchAsset";
  params: typeof TOKEN_WATCH_ASSET;
};

export function buildWalletWatchAssetRequest(): WalletWatchAssetRequest {
  return {
    method: "wallet_watchAsset",
    params: TOKEN_WATCH_ASSET,
  };
}

/**
 * Calls MetaMask / Rabby EIP-747 `wallet_watchAsset` with HANSOME metadata.
 * Logs request + result to console for verification.
 */
export async function requestWatchTokenAsset(walletClient: WalletClient): Promise<boolean> {
  const request = buildWalletWatchAssetRequest();

  console.info(`[${PROJECT.symbol}] wallet_watchAsset →`, JSON.stringify(request, null, 2));

  const added = await walletClient.request({
    method: request.method,
    params: request.params,
  });

  console.info(`[${PROJECT.symbol}] wallet_watchAsset success:`, {
    added,
    image: TOKEN_WALLET_LOGO_URL,
    address: TOKEN_WATCH_ASSET.options.address,
    symbol: TOKEN_WATCH_ASSET.options.symbol,
    decimals: TOKEN_WATCH_ASSET.options.decimals,
  });

  return Boolean(added);
}
