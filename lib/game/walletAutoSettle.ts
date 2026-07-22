import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import { GAME_CHAIN_ID } from "@/lib/game/hansomeGame";
import { isTestnetGaslessResolveEnabled } from "@/lib/game/testnetGaslessResolve";

function readTriStateFlag(raw: string | undefined): boolean | null {
  const flag = raw?.trim();
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return null;
}

/**
 * Whether the Battle Result page may auto-prompt the connected wallet for
 * `finalizeDay` / `creditBatch`.
 *
 * Default: on. Opt out with `NEXT_PUBLIC_WALLET_AUTO_SETTLE=0`.
 * On Testnet with gasless resolve disabled, default off so Railway
 * `settlement-worker-testnet` owns settlement (avoids wallet spam + bad gas estimates).
 */
export function isWalletAutoSettleEnabled(): boolean {
  const explicit = readTriStateFlag(process.env.NEXT_PUBLIC_WALLET_AUTO_SETTLE);
  if (explicit != null) return explicit;
  if (
    GAME_CHAIN_ID === ROBINHOOD_TESTNET_CHAIN_ID &&
    !isTestnetGaslessResolveEnabled()
  ) {
    return false;
  }
  return true;
}

/**
 * Whether AutoReveal may open the wallet unprompted for each NFT reveal.
 * Same Testnet UI-only default as settle: off when gasless is off, so MetaMask
 * is not flooded with surprise popups (including fake "Network suggested" fees).
 * Opt in with `NEXT_PUBLIC_WALLET_AUTO_REVEAL=1`.
 */
export function isWalletAutoRevealEnabled(): boolean {
  const explicit = readTriStateFlag(process.env.NEXT_PUBLIC_WALLET_AUTO_REVEAL);
  if (explicit != null) return explicit;
  // Follow settle flag when set (one switch for UI-only sessions).
  const settleExplicit = readTriStateFlag(process.env.NEXT_PUBLIC_WALLET_AUTO_SETTLE);
  if (settleExplicit === false) return false;
  if (
    GAME_CHAIN_ID === ROBINHOOD_TESTNET_CHAIN_ID &&
    !isTestnetGaslessResolveEnabled()
  ) {
    return false;
  }
  return true;
}
