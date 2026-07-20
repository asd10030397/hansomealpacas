/**
 * Testnet relayer writes with fresh pending nonce (no cross-request cache).
 * Concurrent resolve calls are serialized so two sends cannot reuse one nonce.
 */
import type {
  Account,
  Address,
  Hash,
  PublicClient,
  WalletClient,
  Abi,
} from "viem";
import type { SettlementTimingTrace } from "@/lib/game/server/settlementTimingLog";

/** Process-local queue — does not store nonce values. */
let relayerWriteTail: Promise<void> = Promise.resolve();

function withRelayerWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = relayerWriteTail.then(fn, fn);
  relayerWriteTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function isNonceTooLowError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /nonce too low/i.test(msg) ||
    /nonce provided.*lower than the current nonce/i.test(msg) ||
    /NONCE_EXPIRED/i.test(msg)
  );
}

export type RelayerWriteContractParams = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  /** Max attempts when nonce races (fresh pending nonce each try). */
  maxAttempts?: number;
  waitForReceipt?: boolean;
  /** Optional structured latency trace (server logs only). */
  timing?: SettlementTimingTrace;
  timingLabel?: string;
  batchIndex?: number;
  batchSize?: number;
};

/**
 * Fetch pending nonce → write → optional receipt wait.
 * On nonce-too-low, retry with a new pending nonce (still under the write lock).
 */
export async function writeRelayerContract(
  params: RelayerWriteContractParams,
): Promise<Hash> {
  const {
    publicClient,
    walletClient,
    account,
    address,
    abi,
    functionName,
    args,
    maxAttempts = 3,
    waitForReceipt = true,
    timing,
    timingLabel = functionName,
    batchIndex,
    batchSize,
  } = params;

  const lockWaitStart = performance.now();
  return withRelayerWriteLock(async () => {
    const lockWaitMs = Math.round(performance.now() - lockWaitStart);
    timing?.log("tx_lock_acquired", {
      detail: timingLabel,
      lockWaitMs,
      batchIndex,
      batchSize,
    });

    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const rpcNonceStart = performance.now();
      const nonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: "pending",
      });
      const rpcMs = Math.round(performance.now() - rpcNonceStart);
      try {
        const submitStart = performance.now();
        timing?.log("tx_submit_start", {
          detail: timingLabel,
          attempt: attempt + 1,
          batchIndex,
          batchSize,
          rpcMs,
        });
        const hash = await walletClient.writeContract({
          account,
          address,
          abi,
          functionName,
          args: args as never,
          nonce,
          chain: walletClient.chain,
        });
        const submitMs = Math.round(performance.now() - submitStart);
        timing?.log("tx_hash", {
          detail: timingLabel,
          txHash: hash,
          attempt: attempt + 1,
          submitMs,
          batchIndex,
          batchSize,
        });
        if (waitForReceipt) {
          const receiptStart = performance.now();
          await publicClient.waitForTransactionReceipt({ hash });
          const receiptMs = Math.round(performance.now() - receiptStart);
          timing?.log("tx_receipt", {
            detail: timingLabel,
            txHash: hash,
            receiptMs,
            ms: submitMs + receiptMs,
            attempt: attempt + 1,
            batchIndex,
            batchSize,
            ok: true,
          });
        }
        return hash;
      } catch (e) {
        lastError = e;
        const msg = e instanceof Error ? e.message : String(e);
        const retry = isNonceTooLowError(e) && attempt < maxAttempts - 1;
        timing?.log(retry ? "tx_retry" : "tx_error", {
          detail: `${timingLabel}: ${msg}`,
          attempt: attempt + 1,
          retries: attempt,
          errorCode: isNonceTooLowError(e) ? "nonce_too_low" : "write_failed",
          ok: false,
          batchIndex,
          batchSize,
        });
        if (retry) {
          continue;
        }
        throw e;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError ?? "relayer write failed"));
  });
}

/** Test helper — expose lock drain for tests. */
export async function __drainRelayerWriteLockForTests(): Promise<void> {
  await relayerWriteTail;
}
