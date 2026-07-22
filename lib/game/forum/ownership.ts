import "server-only";

import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type Address,
} from "viem";
import { robinhoodChain, robinhoodTestnetChain } from "@/lib/chain";
import { hansomeGenesisInventoryAbi } from "@/lib/game/abis/hansomeGenesisInventory";
import {
  GENESIS_CHAIN_ID,
  GENESIS_NFT_ADDRESS,
  isGenesisConfigured,
} from "@/lib/game/genesis";
import { resolveGameRpcUrl } from "@/lib/game/gameNetwork";

export async function verifyGenesisTokenOwnership(
  wallet: string,
  tokenId: number,
): Promise<boolean> {
  if (!isGenesisConfigured() || !GENESIS_NFT_ADDRESS) return false;
  if (!isAddress(wallet, { strict: false })) return false;
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 550) return false;

  const chain =
    GENESIS_CHAIN_ID === robinhoodChain.id ? robinhoodChain : robinhoodTestnetChain;

  const client = createPublicClient({
    chain,
    transport: http(resolveGameRpcUrl()),
  });

  try {
    const owner = (await client.readContract({
      address: GENESIS_NFT_ADDRESS as Address,
      abi: hansomeGenesisInventoryAbi,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    })) as Address;
    return getAddress(owner).toLowerCase() === getAddress(wallet).toLowerCase();
  } catch {
    return false;
  }
}
