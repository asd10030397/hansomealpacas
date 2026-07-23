import { isCapacitorNative, shouldPreferWalletConnect } from "@/lib/game/capacitorEnv";

export const NO_WALLET_CONNECT_MESSAGE =
  "No compatible wallet detected. Open this page in MetaMask or OKX Wallet, or install a browser wallet.";

export const CAPACITOR_WALLET_CONNECT_MESSAGE =
  "Connect opens MetaMask or OKX via WalletConnect. Approve in your wallet app, then return to HANSOME.";

/** User dismissed / cancelled the wallet connect prompt. */
export const CONNECTION_CANCELLED_MESSAGE = "Connection cancelled in wallet.";

export type WalletConnectFailReason =
  | "no-connector"
  | "no-provider"
  | "rejected"
  | "failed";

export function hasInjectedEthereum(ethereum: unknown): boolean {
  if (ethereum == null) return false;
  // EIP-1193 providers expose request(); avoid treating placeholders as injected.
  return typeof (ethereum as { request?: unknown }).request === "function";
}

/** WalletConnect pairs with a target chain; injected extension connects accounts first. */
export function shouldBindChainOnConnect(connectorId: string): boolean {
  return connectorId === "walletConnect" || connectorId === "walletConnectLegacy";
}

export function pickInjectedConnector<T extends { id: string }>(
  connectors: readonly T[],
): T | null {
  return connectors.find((c) => c.id === "injected") ?? null;
}

export function pickWalletConnectConnector<T extends { id: string }>(
  connectors: readonly T[],
): T | null {
  return (
    connectors.find((c) => c.id === "walletConnect" || c.id === "walletConnectLegacy") ?? null
  );
}

/**
 * Prefer injected on desktop browser when window.ethereum exists.
 * Capacitor APK WebView and mobile browsers without injection use WalletConnect.
 */
export function pickConnectConnector<T extends { id: string }>(
  connectors: readonly T[],
  hasProvider: boolean,
): T | null {
  if (shouldPreferWalletConnect(hasProvider)) {
    return pickWalletConnectConnector(connectors) ?? pickInjectedConnector(connectors);
  }
  if (hasProvider) {
    return pickInjectedConnector(connectors) ?? connectors[0] ?? null;
  }
  return pickWalletConnectConnector(connectors) ?? pickInjectedConnector(connectors);
}

export function hasWalletConnectConnector(connectors: readonly { id: string }[]): boolean {
  return pickWalletConnectConnector(connectors) != null;
}

export function resolveNoProviderMessage(connectors: readonly { id: string }[]): string {
  if (isCapacitorNative() && !hasWalletConnectConnector(connectors)) {
    return `${NO_WALLET_CONNECT_MESSAGE} (WalletConnect project id missing on server.)`;
  }
  if (isCapacitorNative()) return CAPACITOR_WALLET_CONNECT_MESSAGE;
  return NO_WALLET_CONNECT_MESSAGE;
}

export function metamaskDappDeepLink(host: string, pathWithSearch: string): string {
  const path = pathWithSearch.startsWith("/") ? pathWithSearch : `/${pathWithSearch}`;
  return `https://metamask.app.link/dapp/${host}${path}`;
}

/** OKX Wallet mobile deep link into the current dapp URL. */
export function okxDappDeepLink(pageUrl: string): string {
  const encoded = encodeURIComponent(`okx://wallet/dapp/url?dappUrl=${encodeURIComponent(pageUrl)}`);
  return `https://www.okx.com/download?deeplink=${encoded}`;
}

export function classifyConnectFailure(error: unknown): {
  message: string;
  reason: "rejected" | "failed" | "no-provider";
} {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Wallet connection failed.";
  if (/rejected|denied|User rejected/i.test(msg)) {
    return { message: CONNECTION_CANCELLED_MESSAGE, reason: "rejected" };
  }
  if (/Provider not found|provider|ethereum|Connector not found|does not support/i.test(msg)) {
    return { message: NO_WALLET_CONNECT_MESSAGE, reason: "no-provider" };
  }
  return {
    message: msg.split("\n")[0] ?? msg,
    reason: "failed",
  };
}

/** Pre-flight before calling wagmi connectAsync. */
export function preflightWalletConnect(args: {
  connectors: readonly { id: string }[];
  hasProvider: boolean;
}):
  | { ok: true; connectorId: string }
  | { ok: false; error: string; reason: "no-connector" | "no-provider" } {
  const connector = pickConnectConnector(args.connectors, args.hasProvider);
  if (!connector) {
    return {
      ok: false,
      error: resolveNoProviderMessage(args.connectors),
      reason: "no-connector",
    };
  }
  // Injected-only stack with no in-page provider → help UX, do not call connect().
  if (!args.hasProvider && connector.id === "injected") {
    return {
      ok: false,
      error: resolveNoProviderMessage(args.connectors),
      reason: "no-provider",
    };
  }
  // Capacitor must not call injected() — WebView has no EIP-1193 provider.
  if (isCapacitorNative() && connector.id === "injected") {
    return {
      ok: false,
      error: resolveNoProviderMessage(args.connectors),
      reason: "no-provider",
    };
  }
  return { ok: true, connectorId: connector.id };
}

/** Pure helper: swap primary CTA stays non-swap until connected. */
export function isSwapActionDisabledUntilConnected(args: {
  isConnected: boolean;
  canSubmitSwap: boolean;
}): boolean {
  if (!args.isConnected) return false; // connect button itself stays enabled
  return !args.canSubmitSwap;
}

export function resolveSwapPrimaryKind(args: {
  isConnected: boolean;
  isWrongChain: boolean;
}): "connect" | "switch" | "swap" {
  if (!args.isConnected) return "connect";
  if (args.isWrongChain) return "switch";
  return "swap";
}
