import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { assertAllowedFunction, assertFeeCap } from "../safety/guards.js";
import { log } from "../logger.js";
import type { WorkerConfig } from "../config.js";

export type ChainClients = {
  publicClient: PublicClient;
  settlerAccount: Account;
  seedAccount: Account;
  settlerWallet: WalletClient;
  seedWallet: WalletClient;
};

export function createClients(cfg: WorkerConfig): ChainClients {
  const transport = http(cfg.rpcUrl);
  const publicClient = createPublicClient({ transport });
  const settlerAccount = privateKeyToAccount(cfg.settlerPrivateKey);
  const seedAccount = privateKeyToAccount(cfg.seedPrivateKey);
  const settlerWallet = createWalletClient({
    account: settlerAccount,
    transport,
  });
  const seedWallet = createWalletClient({
    account: seedAccount,
    transport,
  });
  return {
    publicClient,
    settlerAccount,
    seedAccount,
    settlerWallet,
    seedWallet,
  };
}

let writeTail: Promise<void> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeTail.then(fn, fn);
  writeTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isNonceTooLow(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /nonce too low|NONCE_EXPIRED|nonce provided.*lower/i.test(msg);
}

export type WriteParams = {
  cfg: WorkerConfig;
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  maxAttempts?: number;
};

export async function writeContractSafe(params: WriteParams): Promise<Hash | "dry-run"> {
  assertAllowedFunction(params.functionName);

  if (params.cfg.dryRun) {
    log.info("dry_run_tx", {
      functionName: params.functionName,
      address: params.address,
      args: params.args.map((a) => String(a)),
      from: params.account.address,
    });
    return "dry-run";
  }

  const maxAttempts = params.maxAttempts ?? 4;

  return withWriteLock(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const nonce = await params.publicClient.getTransactionCount({
          address: params.account.address,
          blockTag: "pending",
        });

        let maxFeePerGas: bigint | undefined;
        let maxPriorityFeePerGas: bigint | undefined;
        try {
          const fees = await params.publicClient.estimateFeesPerGas();
          maxFeePerGas = fees.maxFeePerGas ?? undefined;
          maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? undefined;
          assertFeeCap({
            maxFeePerGasWei: params.cfg.maxFeePerGasWei,
            quoteMaxFeePerGas: maxFeePerGas ?? null,
          });
        } catch (e) {
          if (String(e).includes("REFUSED: maxFeePerGas")) throw e;
          // legacy gas networks — continue without EIP-1559 fields
        }

        const hash = await params.walletClient.writeContract({
          address: params.address,
          abi: params.abi,
          functionName: params.functionName,
          args: params.args as never,
          account: params.account,
          chain: null,
          nonce,
          gas: params.cfg.gasLimit,
          ...(maxFeePerGas != null ? { maxFeePerGas } : {}),
          ...(maxPriorityFeePerGas != null ? { maxPriorityFeePerGas } : {}),
        });

        log.info("tx_submitted", {
          functionName: params.functionName,
          hash,
          attempt: attempt + 1,
          nonce,
        });

        const receipt = await params.publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
        });
        if (receipt.status !== "success") {
          throw new Error(`tx reverted: ${hash}`);
        }
        log.info("tx_confirmed", {
          functionName: params.functionName,
          hash,
          block: Number(receipt.blockNumber),
          gasUsed: receipt.gasUsed.toString(),
        });
        return hash;
      } catch (e) {
        lastError = e;
        if (isNonceTooLow(e) && attempt < maxAttempts - 1) {
          const backoff = Math.min(8000, 400 * 2 ** attempt);
          log.warn("nonce_retry", { attempt: attempt + 1, backoff });
          await sleep(backoff);
          continue;
        }
        throw e;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  });
}

export async function assertGasBalance(
  publicClient: PublicClient,
  address: Address,
  minWei: bigint,
): Promise<bigint> {
  const bal = await publicClient.getBalance({ address });
  if (bal < minWei) {
    throw new Error(
      `Insufficient ETH: ${address} has ${bal} wei < min ${minWei}`,
    );
  }
  return bal;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export type HexSeed = Hex;
