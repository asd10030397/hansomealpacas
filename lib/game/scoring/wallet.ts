import { SCORING_CONSTANTS } from "./constants";
import type { NftDailyScore, WalletDailyScore } from "./types";

/**
 * Mean of up to K active NFT scores.
 * If more than K: lowest tokenIds (deterministic). Never sum / best-K.
 */
export function scoreWalletsForDay(
  nftScores: NftDailyScore[],
  K = SCORING_CONSTANTS.K,
): WalletDailyScore[] {
  const byOwner = new Map<string, NftDailyScore[]>();
  for (const n of nftScores) {
    const list = byOwner.get(n.owner) ?? [];
    list.push(n);
    byOwner.set(n.owner, list);
  }

  const wallets: WalletDailyScore[] = [];
  for (const [owner, list] of byOwner) {
    const sorted = [...list].sort((a, b) => a.tokenId - b.tokenId);
    const activeTokenIds = sorted.map((x) => x.tokenId);
    const counted = sorted.slice(0, K);
    const score =
      counted.length === 0
        ? 0
        : counted.reduce((s, x) => s + x.score, 0) / counted.length;

    wallets.push({
      owner,
      score,
      activeTokenIds,
      countedTokenIds: counted.map((x) => x.tokenId),
      active: counted.length > 0,
    });
  }

  return wallets.sort((a, b) => a.owner.localeCompare(b.owner));
}
