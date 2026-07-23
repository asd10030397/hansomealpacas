import { describe, expect, it, vi } from "vitest";
import {
  classifyConnectFailure,
  CONNECTION_CANCELLED_MESSAGE,
  hasInjectedEthereum,
  metamaskDappDeepLink,
  NO_WALLET_CONNECT_MESSAGE,
  okxDappDeepLink,
  pickConnectConnector,
  pickInjectedConnector,
  pickWalletConnectConnector,
  preflightWalletConnect,
  resolveSwapPrimaryKind,
  shouldBindChainOnConnect,
} from "@/lib/game/walletConnect";
import {
  resolveClaimWalletPrimary,
  resolveWalletConnectUiSurface,
  shouldOpenWalletHelp,
  shouldResetSwapTxOnDisconnect,
  swapBannerKindForConnectFailure,
} from "@/lib/game/walletConnectUi";

vi.mock("@/lib/game/capacitorEnv", () => ({
  isCapacitorNative: () => false,
  shouldPreferWalletConnect: (hasProvider: boolean) => !hasProvider,
  isMobileUserAgent: () => false,
}));

describe("walletConnect helpers", () => {
  it("a) detects injected provider available", () => {
    expect(hasInjectedEthereum({ request: async () => [] })).toBe(true);
    const preflight = preflightWalletConnect({
      connectors: [{ id: "injected" }],
      hasProvider: true,
    });
    expect(preflight.ok).toBe(true);
    if (preflight.ok) expect(preflight.connectorId).toBe("injected");
  });

  it("b) fails visibly with no injected provider (does not call connect)", () => {
    expect(hasInjectedEthereum(undefined)).toBe(false);
    expect(hasInjectedEthereum(null)).toBe(false);
    const result = preflightWalletConnect({
      connectors: [{ id: "injected" }],
      hasProvider: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no-provider");
      expect(result.error).toBe(NO_WALLET_CONNECT_MESSAGE);
      expect(result.error).toMatch(/No compatible wallet detected/i);
    }
  });

  it("c) prefers WalletConnect when available and no injected provider", () => {
    expect(pickWalletConnectConnector([{ id: "walletConnect" }, { id: "injected" }])?.id).toBe(
      "walletConnect",
    );
    expect(
      pickConnectConnector([{ id: "injected" }, { id: "walletConnect" }], false)?.id,
    ).toBe("walletConnect");
    const preflight = preflightWalletConnect({
      connectors: [{ id: "injected" }, { id: "walletConnect" }],
      hasProvider: false,
    });
    expect(preflight.ok).toBe(true);
    if (preflight.ok) expect(preflight.connectorId).toBe("walletConnect");
  });

  it("d) classifies user rejection separately from provider errors", () => {
    const rejected = classifyConnectFailure(new Error("User rejected the request"));
    expect(rejected.reason).toBe("rejected");
    expect(rejected.message).toBe(CONNECTION_CANCELLED_MESSAGE);
    expect(classifyConnectFailure(new Error("Connection rejected by user")).reason).toBe(
      "rejected",
    );
    const providerErr = classifyConnectFailure(
      new Error("Provider not found. Version: @wagmi/core@3.6.1"),
    );
    expect(providerErr.reason).toBe("no-provider");
    expect(providerErr.message).toBe(NO_WALLET_CONNECT_MESSAGE);
  });

  it("rejected connection uses non-modal feedback (not help, not tx failure)", () => {
    expect(shouldOpenWalletHelp("rejected")).toBe(false);
    expect(resolveWalletConnectUiSurface("rejected", false)).toBe("feedback");
    expect(resolveWalletConnectUiSurface("rejected", true)).toBe("help");
    expect(swapBannerKindForConnectFailure()).toBe("connection");
  });

  it("no-provider opens help surface and does not classify as transaction failure", () => {
    expect(shouldOpenWalletHelp("no-provider")).toBe(true);
    expect(resolveWalletConnectUiSurface("no-provider", true)).toBe("help");
    expect(swapBannerKindForConnectFailure()).not.toBe("transaction" as never);
  });

  it("Claim page wallet CTA: connect / switch / claim", () => {
    expect(
      resolveClaimWalletPrimary({ isConnected: false, isWrongChain: false }),
    ).toBe("connect");
    expect(
      resolveClaimWalletPrimary({ isConnected: true, isWrongChain: true }),
    ).toBe("switch");
    expect(
      resolveClaimWalletPrimary({ isConnected: true, isWrongChain: false }),
    ).toBe("claim");
  });

  it("Swap disconnect clears account state only (no tx/routing reset)", () => {
    expect(shouldResetSwapTxOnDisconnect()).toBe(false);
  });

  it("rejected connection surfaces feedback on Swap, Mint, and Game (shared helper)", () => {
    // All three surfaces mount WalletConnectProvider → same UI surface rules.
    for (const surface of ["swap", "mint", "game"] as const) {
      expect(resolveWalletConnectUiSurface("rejected", false)).toBe("feedback");
      expect(shouldOpenWalletHelp("rejected")).toBe(false);
      expect(surface).toBeTruthy();
    }
  });

  it("e) swap primary stays connect until wallet is connected", () => {
    expect(resolveSwapPrimaryKind({ isConnected: false, isWrongChain: false })).toBe("connect");
    expect(resolveSwapPrimaryKind({ isConnected: true, isWrongChain: true })).toBe("switch");
    expect(resolveSwapPrimaryKind({ isConnected: true, isWrongChain: false })).toBe("swap");
  });

  it("binds chainId at connect only for WalletConnect connectors", () => {
    expect(shouldBindChainOnConnect("walletConnect")).toBe(true);
    expect(shouldBindChainOnConnect("walletConnectLegacy")).toBe(true);
    expect(shouldBindChainOnConnect("injected")).toBe(false);
  });

  it("picks injected connector first when provider exists", () => {
    expect(pickInjectedConnector([{ id: "walletConnect" }, { id: "injected" }])?.id).toBe(
      "injected",
    );
    expect(pickConnectConnector([{ id: "injected" }, { id: "walletConnect" }], true)?.id).toBe(
      "injected",
    );
    expect(pickInjectedConnector([])).toBeNull();
  });

  it("builds MetaMask and OKX deep links", () => {
    expect(metamaskDappDeepLink("www.hansomealpacas.xyz", "/swap")).toBe(
      "https://metamask.app.link/dapp/www.hansomealpacas.xyz/swap",
    );
    const okx = okxDappDeepLink("https://www.hansomealpacas.xyz/swap");
    expect(okx).toContain("okx.com/download");
    expect(okx).toContain("dappUrl");
    expect(okx).toContain("hansomealpacas.xyz");
  });
});
