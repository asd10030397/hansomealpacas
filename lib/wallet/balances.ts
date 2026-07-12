import { createPublicClient, formatUnits, http } from "viem";
import { DEFAULT_RPC_URL, TOKEN_ADDRESS, TOKEN_DECIMALS, robinhoodChain } from "@/lib/chain";
import { erc20Abi } from "@/lib/swap/abis";
import { OFFICIAL_WALLETS } from "@/content/transparency";

export type OfficialWalletBalance = {
  id: string;
  hansome: string;
};

/**
 * Reads the current on-chain HANSOME balance for every official wallet.
 * This is the live source of truth referenced by the Litepaper and the
 * /transparency page — allocations in content/transparency.ts describe the
 * *initial* distribution at launch, not the current balance.
 */
export async function readOfficialWalletBalances(): Promise<OfficialWalletBalance[]> {
  const client = createPublicClient({
    chain: robinhoodChain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL),
  });

  return Promise.all(
    OFFICIAL_WALLETS.map(async (wallet) => {
      const raw = await client.readContract({
        address: TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet.address as `0x${string}`],
      });
      return { id: wallet.id, hansome: formatUnits(raw, TOKEN_DECIMALS) };
    }),
  );
}
