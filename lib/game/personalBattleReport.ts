import { zeroHash } from "viem";

/**
 * Personal Battle Report token filter (UI only).
 * Global settlement still uses all on-chain participants; this only decides
 * which owned NFTs appear in the connected wallet's Result page for `day`.
 */
export function selectPersonalBattleTokenIds(input: {
  ownedTokenIds: readonly number[];
  /** commitHashOf(tokenId, day) aligned with ownedTokenIds indices */
  commitHashes: readonly (`0x${string}` | undefined | null)[];
  /** Legacy localStorage secrets for this wallet + day */
  secretTokenIds?: readonly number[];
}): number[] {
  const fromChain = new Set<number>();
  for (let i = 0; i < input.ownedTokenIds.length; i++) {
    const tokenId = input.ownedTokenIds[i]!;
    const hash = input.commitHashes[i];
    if (hash && hash !== zeroHash) fromChain.add(tokenId);
  }
  for (const id of input.secretTokenIds ?? []) {
    if (input.ownedTokenIds.includes(id)) fromChain.add(id);
  }
  // Stable order: owned inventory order.
  return input.ownedTokenIds.filter((id) => fromChain.has(id));
}
