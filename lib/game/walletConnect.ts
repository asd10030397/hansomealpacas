export const NO_WALLET_CONNECT_MESSAGE =
  "Unable to open wallet connection. Please open this page in MetaMask or use WalletConnect.";

export type WalletConnectFailReason =
  | "no-connector"
  | "no-provider"
  | "rejected"
  | "failed";

export function hasInjectedEthereum(ethereum: unknown): boolean {
  return ethereum != null;
}

export function pickInjectedConnector<T extends { id: string }>(
  connectors: readonly T[],
): T | null {
  return connectors.find((c) => c.id === "injected") ?? connectors[0] ?? null;
}

export function metamaskDappDeepLink(host: string, pathWithSearch: string): string {
  const path = pathWithSearch.startsWith("/") ? pathWithSearch : `/${pathWithSearch}`;
  return `https://metamask.app.link/dapp/${host}${path}`;
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
    return { message: "Connection cancelled in wallet.", reason: "rejected" };
  }
  if (/provider|ethereum|Connector not found|does not support/i.test(msg)) {
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
  const connector = pickInjectedConnector(args.connectors);
  if (!connector) {
    return { ok: false, error: NO_WALLET_CONNECT_MESSAGE, reason: "no-connector" };
  }
  if (!args.hasProvider) {
    return { ok: false, error: NO_WALLET_CONNECT_MESSAGE, reason: "no-provider" };
  }
  return { ok: true, connectorId: connector.id };
}
