import { describe, expect, it } from "vitest";
import {
  classifyConnectFailure,
  hasInjectedEthereum,
  metamaskDappDeepLink,
  NO_WALLET_CONNECT_MESSAGE,
  pickInjectedConnector,
  preflightWalletConnect,
} from "@/lib/game/walletConnect";

describe("walletConnect helpers", () => {
  it("detects missing injected provider", () => {
    expect(hasInjectedEthereum(undefined)).toBe(false);
    expect(hasInjectedEthereum(null)).toBe(false);
    expect(hasInjectedEthereum({})).toBe(true);
  });

  it("picks injected connector first", () => {
    expect(pickInjectedConnector([{ id: "walletConnect" }, { id: "injected" }])?.id).toBe(
      "injected",
    );
    expect(pickInjectedConnector([{ id: "only" }])?.id).toBe("only");
    expect(pickInjectedConnector([])).toBeNull();
  });

  it("preflight fails visibly without provider", () => {
    const result = preflightWalletConnect({
      connectors: [{ id: "injected" }],
      hasProvider: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no-provider");
      expect(result.error).toBe(NO_WALLET_CONNECT_MESSAGE);
    }
  });

  it("preflight fails without connectors", () => {
    const result = preflightWalletConnect({ connectors: [], hasProvider: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no-connector");
  });

  it("classifies user rejection", () => {
    expect(classifyConnectFailure(new Error("User rejected the request")).reason).toBe(
      "rejected",
    );
  });

  it("builds MetaMask deep link", () => {
    expect(metamaskDappDeepLink("game.hansomealpacas.xyz", "/mint")).toBe(
      "https://metamask.app.link/dapp/game.hansomealpacas.xyz/mint",
    );
  });
});
