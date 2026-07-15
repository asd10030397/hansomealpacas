import { FetchRequest, JsonRpcProvider } from "ethers";
import { config } from "../config";
import { createLogger } from "../logger";

const logger = createLogger("provider");

/**
 * Robinhood Chain's free public RPC (the one this bot uses by default —
 * same URL the website already uses) does not expose a standard
 * `eth_subscribe` WebSocket for logs, only a low-level sequencer feed
 * that isn't a drop-in for ethers' WebSocketProvider. Real WSS log
 * subscriptions require a paid provider (Alchemy/QuickNode/Validation
 * Cloud). So v1 always polls over HTTP; `config.chain.wsRpcUrl` is kept
 * as a documented extension point for later rather than being wired up
 * now (see README "Future Expansion").
 */
export function createProvider(): JsonRpcProvider {
  // ethers' default per-request timeout is 300_000ms (5 minutes) — far too
  // long for a service that's supposed to detect and recover from RPC
  // trouble quickly. A stalled request (server accepts the connection but
  // never responds) would otherwise sit silently for up to 5 minutes with
  // no error logged and no retry/backoff triggered, which looks exactly
  // like "the listener isn't doing anything" from the outside.
  const fetchRequest = new FetchRequest(config.chain.rpcUrl);
  fetchRequest.timeout = config.listener.rpcTimeoutMs;

  const provider = new JsonRpcProvider(fetchRequest, config.chain.chainId, {
    staticNetwork: true,
  });
  logger.info(`HTTP provider ready → ${config.chain.rpcUrl} (timeout=${config.listener.rpcTimeoutMs}ms)`);
  return provider;
}

/**
 * ethers v6 JsonRpcProvider has no persistent socket to "drop", but a
 * fresh instance clears any bad internal state (e.g. after repeated
 * timeouts) and is cheap to create. The listener calls this when its
 * error-backoff escalates past a threshold — see listener.ts.
 */
export function recreateProvider(previous: JsonRpcProvider): JsonRpcProvider {
  previous.destroy();
  return createProvider();
}
