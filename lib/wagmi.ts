import { QueryClient } from "@tanstack/react-query";
import { createConfig, http, injected } from "wagmi";
import {
  DEFAULT_RPC_URL,
  ROBINHOOD_CHAIN_ID,
  robinhoodChain,
  robinhoodTestnetChain,
} from "@/lib/chain";

const gameChainId = Number(process.env.NEXT_PUBLIC_GAME_CHAIN_ID?.trim() || "0");
const gameRpc = process.env.NEXT_PUBLIC_GAME_RPC_URL?.trim() || "";

/** Mainnet game cutover: bind game RPC to Mainnet chain transport. */
const mainnetHttp =
  gameChainId === ROBINHOOD_CHAIN_ID
    ? http(gameRpc || DEFAULT_RPC_URL)
    : http();

/** Testnet game: bind game RPC to Testnet transport only (never when Mainnet mode). */
const testnetHttp =
  gameChainId === ROBINHOOD_CHAIN_ID
    ? http()
    : http(gameRpc || undefined);

/**
 * Injected only in createConfig — importing `wagmi/connectors` barrel pulls optional
 * deps that break the Next production build. Mobile browsers without window.ethereum
 * use WalletHelpModal deep links (MetaMask / OKX) instead of calling injected connect.
 * WalletConnect QR can be added later via a dedicated import once projectId + deps are set.
 */
export const wagmiConfig = createConfig({
  chains: [robinhoodChain, robinhoodTestnetChain],
  connectors: [injected()],
  transports: {
    [robinhoodChain.id]: mainnetHttp,
    [robinhoodTestnetChain.id]: testnetHttp,
  },
  ssr: true,
});

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
