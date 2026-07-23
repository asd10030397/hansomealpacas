import { QueryClient } from "@tanstack/react-query";
import { createConfig, http, injected, type CreateConnectorFn } from "wagmi";
import { walletConnect } from "wagmi/connectors/walletConnect";
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

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";

const dappMetadata = {
  name: "HANSOME",
  description: "Alpaca vs Cougar — Robinhood Chain game",
  url: "https://game.hansomealpacas.xyz",
  icons: ["https://game.hansomealpacas.xyz/icons/icon-512.png"],
};

/**
 * Injected for desktop extension browsers; WalletConnect for Capacitor APK WebView
 * and mobile browsers without window.ethereum.
 *
 * Uses wagmi/connectors/walletConnect (not wagmi/connectors barrel) to avoid
 * optional peer dependency breakage in Next production builds.
 */
function buildConnectors(): CreateConnectorFn[] {
  const list: CreateConnectorFn[] = [injected()];

  if (walletConnectProjectId) {
    list.push(
      walletConnect({
        projectId: walletConnectProjectId,
        metadata: dappMetadata,
        // Reown AppKit: mobile deep-links into wallet; desktop shows QR when no extension.
        showQrModal: true,
        isNewChainsStale: false,
        qrModalOptions: {
          enableMobileFullScreen: true,
        },
      }),
    );
  }

  return list;
}

export const wagmiConfig = createConfig({
  chains: [robinhoodChain, robinhoodTestnetChain],
  connectors: buildConnectors(),
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

export const isWalletConnectConfigured = Boolean(walletConnectProjectId);
