/**
 * Pure wallet-connect UX helpers (no wagmi).
 * Prefer reason codes / CTA kinds over brittle copy matching in tests.
 */

import type { WalletConnectFailReason } from "@/lib/game/walletConnect";
import {
  CONNECTION_CANCELLED_MESSAGE,
  NO_WALLET_CONNECT_MESSAGE,
} from "@/lib/game/walletConnect";

export type WalletConnectUiSurface = "feedback" | "help" | "none";

/** Where to surface a connect failure (connection UX ≠ transaction UX). */
export function resolveWalletConnectUiSurface(
  reason: WalletConnectFailReason | null,
  helpOpen: boolean,
): WalletConnectUiSurface {
  if (!reason) return "none";
  // Help modal owns no-provider / non-reject failures while open.
  if (helpOpen) return "help";
  // Reject/cancel (and any residual error with help closed) → non-modal banner.
  return "feedback";
}

export function shouldOpenWalletHelp(reason: WalletConnectFailReason): boolean {
  return reason !== "rejected";
}

/** Swap banner kind for connect failures — never "transaction". */
export function swapBannerKindForConnectFailure(): "connection" {
  return "connection";
}

/**
 * Disconnect on Swap must clear wagmi account only.
 * Quote / tx phase / routing state stay untouched.
 */
export function shouldResetSwapTxOnDisconnect(): boolean {
  return false;
}

export type ClaimWalletPrimaryKind = "connect" | "switch" | "claim";

export function resolveClaimWalletPrimary(args: {
  isConnected: boolean;
  isWrongChain: boolean;
}): ClaimWalletPrimaryKind {
  if (!args.isConnected) return "connect";
  if (args.isWrongChain) return "switch";
  return "claim";
}

/** Stable English fallbacks (display layer localizes by reason when possible). */
export function connectFailureFallbackMessage(
  reason: WalletConnectFailReason,
): string {
  if (reason === "rejected") return CONNECTION_CANCELLED_MESSAGE;
  if (reason === "no-provider" || reason === "no-connector") {
    return NO_WALLET_CONNECT_MESSAGE;
  }
  return "Wallet connection failed.";
}
