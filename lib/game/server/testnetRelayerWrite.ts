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
  } = params;

  return withRelayerWriteLock(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const nonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: "pending",
      });
      try {
        const hash = await walletClient.writeContract({
          account,
          address,
          abi,
          functionName,
          args: args as never,
          nonce,
          chain: walletClient.chain,
        });
        if (waitForReceipt) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        return hash;
      } catch (e) {
        lastError = e;
        if (isNonceTooLowError(e) && attempt < maxAttempts - 1) {
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
