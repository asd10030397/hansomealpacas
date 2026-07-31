import { createPublicClient, getAddress, http, type Address } from "viem";
import { DEFAULT_RPC_URL, robinhoodChain } from "@/lib/chain";
import { BURN_ADDRESSES, tokenMetaAbi } from "@/lib/hansome-score/constants";
import { formatTokenAmount } from "@/lib/hansome-score/rpc";
import type { BurnAddressBalance } from "@/lib/hansome-score/supply-burn/types";

function client() {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL),
  });
}

/** Sorted, de-duplicated allowlisted dead/burn addresses — never heuristic “stuck” wallets. */
export function allowlistedBurnAddresses(): Address[] {
  const seen = new Set<string>();
  const out: Address[] = [];
  for (const raw of BURN_ADDRESSES) {
    const addr = getAddress(raw) as Address;
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export type DeadInventoryResult = {
  balances: BurnAddressBalance[];
  knownBurnedRaw: bigint | null;
  knownBurnedFormatted: string | null;
  burnedPctOfTotalSupply: number | null;
  notes: string[];
};

/**
 * P0: RPC balanceOf for allowlisted dead addresses.
 * Does not use holders pagination; does not infer unlabeled contracts.
 */
export async function fetchDeadAddressInventory(input: {
  tokenAddress: string;
  totalSupply: bigint | null;
  decimals: number | null;
}): Promise<DeadInventoryResult> {
  const notes: string[] = [];
  const c = client();
  const token = getAddress(input.tokenAddress) as Address;
  const addresses = allowlistedBurnAddresses();

  const reads = await Promise.all(
    addresses.map(async (account) => {
      try {
        const bal = await c.readContract({
          address: token,
          abi: tokenMetaAbi,
          functionName: "balanceOf",
          args: [account],
        });
        return typeof bal === "bigint" ? { account, bal } : { account, bal: null };
      } catch {
        return { account, bal: null };
      }
    }),
  );

  let known: bigint | null = 0n;
  let anyFailed = false;
  const balances: BurnAddressBalance[] = [];

  for (const { account, bal } of reads) {
    if (bal == null) {
      anyFailed = true;
      continue;
    }
    known += bal;
    const pct =
      input.totalSupply != null && input.totalSupply > 0n
        ? (Number(bal) / Number(input.totalSupply)) * 100
        : null;
    balances.push({
      address: account,
      label: "burn_dead",
      balanceRaw: bal.toString(),
      balanceFormatted: formatTokenAmount(bal, input.decimals),
      percentOfTotalSupply: pct,
    });
  }

  if (anyFailed && balances.length === 0) {
    notes.push("RPC balanceOf failed for all allowlisted burn addresses.");
    return {
      balances: [],
      knownBurnedRaw: null,
      knownBurnedFormatted: null,
      burnedPctOfTotalSupply: null,
      notes,
    };
  }
  if (anyFailed) {
    notes.push(
      "Partial dead-address inventory — some allowlisted balanceOf calls failed.",
    );
  }

  const burnedPct =
    known != null && input.totalSupply != null && input.totalSupply > 0n
      ? (Number(known) / Number(input.totalSupply)) * 100
      : null;

  return {
    balances,
    knownBurnedRaw: known,
    knownBurnedFormatted: formatTokenAmount(known, input.decimals),
    burnedPctOfTotalSupply: burnedPct,
    notes,
  };
}

/** Pure helper for unit tests — aggregate allowlisted balances only. */
export function aggregateKnownBurned(
  balances: { address: string; balanceRaw: string }[],
  totalSupply: bigint | null,
  decimals: number | null,
): Pick<
  DeadInventoryResult,
  "knownBurnedRaw" | "knownBurnedFormatted" | "burnedPctOfTotalSupply"
> {
  const allow = new Set([...BURN_ADDRESSES].map((a) => a.toLowerCase()));
  let sum = 0n;
  for (const b of balances) {
    if (!allow.has(b.address.toLowerCase())) continue;
    try {
      sum += BigInt(b.balanceRaw);
    } catch {
      /* skip */
    }
  }
  const burnedPct =
    totalSupply != null && totalSupply > 0n
      ? (Number(sum) / Number(totalSupply)) * 100
      : null;
  return {
    knownBurnedRaw: sum,
    knownBurnedFormatted: formatTokenAmount(sum, decimals),
    burnedPctOfTotalSupply: burnedPct,
  };
}
