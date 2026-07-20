/**
 * Game-facing chain / RPC / explorer resolution.
 * Mainnet mode (4663) never falls back to Testnet RPC, explorer, or chain id 46630.
 */

import {
  DEFAULT_EXPLORER,
  DEFAULT_RPC_URL,
  DEFAULT_TESTNET_EXPLORER,
  DEFAULT_TESTNET_RPC_URL,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "@/lib/chain";

/** Static read so Next can inline NEXT_PUBLIC_GAME_CHAIN_ID. */
function readGameChainIdEnv(): string {
  return process.env.NEXT_PUBLIC_GAME_CHAIN_ID?.trim() || "";
}

function readGameRpcEnv(): string {
  return process.env.NEXT_PUBLIC_GAME_RPC_URL?.trim() || "";
}

function readGameExplorerEnv(): string {
  return process.env.NEXT_PUBLIC_GAME_EXPLORER?.trim() || "";
}

/**
 * Alias accepted in ops docs. Prefer NEXT_PUBLIC_GAME_EXPLORER.
 * Static property access only — never process.env[key].
 */
function readBlockExplorerAliasEnv(): string {
  return process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL?.trim() || "";
}

/** Resolved game chain id. Unset defaults to Testnet (current Production). */
export function resolveGameChainId(): number {
  const raw = readGameChainIdEnv();
  if (!raw) return ROBINHOOD_TESTNET_CHAIN_ID;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return ROBINHOOD_TESTNET_CHAIN_ID;
  return id;
}

export function isGameMainnetMode(): boolean {
  return resolveGameChainId() === ROBINHOOD_CHAIN_ID;
}

export function isGameTestnetMode(): boolean {
  return resolveGameChainId() === ROBINHOOD_TESTNET_CHAIN_ID;
}

/**
 * Game RPC for the configured game chain.
 * Mainnet: explicit GAME_RPC or Mainnet default — never Testnet RPC.
 * Testnet: explicit GAME_RPC or Testnet default.
 */
export function resolveGameRpcUrl(): string {
  const explicit = readGameRpcEnv();
  if (isGameMainnetMode()) {
    if (explicit) return explicit;
    return DEFAULT_RPC_URL;
  }
  return explicit || DEFAULT_TESTNET_RPC_URL;
}

/**
 * Game block explorer base URL.
 * Accepts NEXT_PUBLIC_GAME_EXPLORER or NEXT_PUBLIC_BLOCK_EXPLORER_URL alias.
 */
export function resolveGameExplorerUrl(): string {
  const explicit = readGameExplorerEnv() || readBlockExplorerAliasEnv();
  if (isGameMainnetMode()) {
    if (explicit) return explicit;
    return DEFAULT_EXPLORER;
  }
  return explicit || DEFAULT_TESTNET_EXPLORER;
}

export function looksLikeTestnetRpcUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes("testnet") || u.includes("rpc.testnet");
}

export function looksLikeTestnetExplorerUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes("testnet") || u.includes("explorer.testnet");
}

/**
 * Fail-closed network checks when Mainnet game mode is selected.
 * Safe to call from Node instrumentation — never logs secrets.
 */
export function assertGameNetworkConfig(): void {
  const chainId = resolveGameChainId();
  if (chainId !== ROBINHOOD_CHAIN_ID) return;

  const rpc = resolveGameRpcUrl();
  if (looksLikeTestnetRpcUrl(rpc)) {
    throw new Error(
      `[hansome] Mainnet game mode (4663) must not use a Testnet RPC URL. Got: ${rpc}`,
    );
  }

  const explorer = resolveGameExplorerUrl();
  if (looksLikeTestnetExplorerUrl(explorer)) {
    throw new Error(
      `[hansome] Mainnet game mode (4663) must not use a Testnet explorer. Got: ${explorer}`,
    );
  }
}
