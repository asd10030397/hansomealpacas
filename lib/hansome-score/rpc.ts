import { createPublicClient, formatUnits, http, type Address, getAddress } from "viem";
import {
  DEFAULT_RPC_URL,
  robinhoodChain,
} from "@/lib/chain";
import {
  POOL_MANAGER_ADDRESS,
  tokenMetaAbi,
} from "@/lib/hansome-score/constants";
import { withRpcTiming } from "@/lib/hansome-score/critical-path-profiler";

/** Bound RPC hangs so Deep liquidity/relationship work cannot stall forever. */
const RPC_TRANSPORT_TIMEOUT_MS = 20_000;

function client() {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL, {
      timeout: RPC_TRANSPORT_TIMEOUT_MS,
    }),
  });
}

export type RpcTokenMeta = {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: bigint | null;
  poolManagerBalance: bigint | null;
  deployerBalance: bigint | null;
};

/**
 * Read contract bytecode. Returns `null` when the RPC call fails (do not treat as EOA).
 * Empty code (`"0x"`) means no contract at the address.
 */
export async function readBytecode(tokenAddress: string): Promise<string | null> {
  return withRpcTiming("robinhood_rpc", "getBytecode", async () => {
    try {
      const c = client();
      const address = getAddress(tokenAddress) as Address;
      const code = await c.getBytecode({ address });
      return code ?? "0x";
    } catch {
      return null;
    }
  });
}

export async function readTokenViaRpc(
  tokenAddress: string,
  deployer: string | null,
): Promise<RpcTokenMeta> {
  return withRpcTiming("robinhood_rpc", "readTokenMeta", async () => {
    const c = client();
    const address = getAddress(tokenAddress) as Address;

    const [name, symbol, decimals, totalSupply, poolManagerBalance, deployerBalance] =
      await Promise.all([
        c
          .readContract({ address, abi: tokenMetaAbi, functionName: "name" })
          .catch(() => null),
        c
          .readContract({ address, abi: tokenMetaAbi, functionName: "symbol" })
          .catch(() => null),
        c
          .readContract({ address, abi: tokenMetaAbi, functionName: "decimals" })
          .catch(() => null),
        c
          .readContract({ address, abi: tokenMetaAbi, functionName: "totalSupply" })
          .catch(() => null),
        c
          .readContract({
            address,
            abi: tokenMetaAbi,
            functionName: "balanceOf",
            args: [POOL_MANAGER_ADDRESS],
          })
          .catch(() => null),
        deployer
          ? c
              .readContract({
                address,
                abi: tokenMetaAbi,
                functionName: "balanceOf",
                args: [getAddress(deployer) as Address],
              })
              .catch(() => null)
          : Promise.resolve(null),
      ]);

    return {
      name: typeof name === "string" ? name : null,
      symbol: typeof symbol === "string" ? symbol : null,
      decimals: typeof decimals === "number" ? decimals : null,
      totalSupply: typeof totalSupply === "bigint" ? totalSupply : null,
      poolManagerBalance:
        typeof poolManagerBalance === "bigint" ? poolManagerBalance : null,
      deployerBalance:
        typeof deployerBalance === "bigint" ? deployerBalance : null,
    };
  });
}

export function formatTokenAmount(
  raw: bigint | null,
  decimals: number | null,
): string | null {
  if (raw == null || decimals == null) return null;
  try {
    return formatUnits(raw, decimals);
  } catch {
    return raw.toString();
  }
}
