/**
 * Presentation helpers for NFT identity on Battle Result cards.
 * Does not affect settlement or reward math.
 */

import { MOCK_NFTS } from "@/data/game/mock";
import { ipfsToHttps, metadataUrlForToken } from "@/lib/game/genesisIdentity";
import { parseGenesisMetadataIdentity } from "@/lib/game/genesisNftReveal";
import { getTestnetGameplayIdentity } from "@/lib/game/testnetGameplayTraits";
import type { GameplayClass, NftSide } from "@/types/game";

export const NFT_IMAGE_FALLBACK_COUGAR = "/pixel/cougar/mint/image/cougar.png";
export const NFT_IMAGE_FALLBACK_ALPACA = "/assets/characters/alpaca-hero-ranch.png";

const PLACEHOLDER_RE =
  /placeholder|alpaca-placeholder|cougar-placeholder|loc-\d\.svg/i;

export type NftDisplayIdentity = {
  tokenId: number;
  side: NftSide | null;
  gameplayClass: GameplayClass | null;
  image: string;
  title: string;
};

export function shortAddress(address?: string | null): string {
  if (!address) return "—";
  const a = address.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function isWeakNftImage(src?: string | null): boolean {
  if (!src) return true;
  return PLACEHOLDER_RE.test(src);
}

export function speciesClassLabel(
  side: NftSide | null | undefined,
  gameplayClass: GameplayClass | null | undefined,
): string {
  if (side === "Cougar") return "Cougar";
  if (!side || side === "Unknown") {
    if (gameplayClass && gameplayClass !== "None") return gameplayClass;
    return "Genesis NFT";
  }
  if (!gameplayClass || gameplayClass === "None" || gameplayClass === "Common") {
    return gameplayClass === "Common" ? "Common Alpaca" : "Alpaca";
  }
  return `${gameplayClass} Alpaca`;
}

export function formatBattleRewardLabel(input: {
  rewardLabel: string;
  missedReveal?: boolean;
}): string {
  if (input.missedReveal) return "0 HANSOME";
  const raw = input.rewardLabel.trim();
  if (!raw || raw === "—" || raw === "0 / unread") return raw || "—";
  if (raw.startsWith("+")) return raw;
  // Already unit-suffixed from settlement view
  if (/hansome/i.test(raw)) {
    const numeric = raw.replace(/^[+\s]+/, "");
    return numeric.startsWith("0") && /^0(\.0+)?(\s|$)/.test(numeric)
      ? numeric
      : `+${numeric}`;
  }
  return `+${raw} HANSOME`;
}

export function formatBattleStatus(outcome: string): string {
  const o = outcome.trim();
  if (!o) return "—";
  if (/escaped/i.test(o)) return "Escaped";
  if (/hunt success/i.test(o)) return "Hunting Success";
  if (/hunt miss/i.test(o)) return "Hunt Failed";
  if (/hunted/i.test(o)) return "Hunted";
  if (/safe/i.test(o)) return "Safe";
  if (/survived/i.test(o)) return "Survived";
  return o;
}

export function fallbackImageForSide(side: NftSide | null | undefined): string {
  return side === "Cougar" ? NFT_IMAGE_FALLBACK_COUGAR : NFT_IMAGE_FALLBACK_ALPACA;
}

/** Sync best-effort identity from owned inventory / mock / testnet deck. */
export function resolveNftDisplaySync(input: {
  tokenId: number;
  side?: NftSide | null;
  gameplayClass?: GameplayClass | null;
  image?: string | null;
}): NftDisplayIdentity {
  const mock = MOCK_NFTS.find((n) => n.tokenId === input.tokenId);
  const testnet = getTestnetGameplayIdentity(input.tokenId);
  const side = input.side ?? mock?.side ?? testnet?.side ?? null;
  const gameplayClass =
    input.gameplayClass ??
    mock?.gameplayClass ??
    testnet?.gameplayClass ??
    (side === "Cougar" ? "None" : "Common");
  let image = input.image ?? mock?.image ?? null;
  if (isWeakNftImage(image)) {
    image = side === "Cougar" ? NFT_IMAGE_FALLBACK_COUGAR : (mock?.image ?? null);
  }
  if (isWeakNftImage(image)) {
    image = fallbackImageForSide(side);
  }
  const title = speciesClassLabel(side, gameplayClass);
  return {
    tokenId: input.tokenId,
    side,
    gameplayClass,
    image: image!,
    title,
  };
}

type MetaJson = {
  image?: string;
  name?: string;
  attributes?: unknown;
};

/** Fetch production metadata image; keep sync fields if fetch fails. */
export async function enrichNftDisplayImage(
  base: NftDisplayIdentity,
): Promise<NftDisplayIdentity> {
  const looksLikeFallback =
    isWeakNftImage(base.image) ||
    base.image === NFT_IMAGE_FALLBACK_ALPACA ||
    base.image === NFT_IMAGE_FALLBACK_COUGAR;
  // Keep real metadata / owned art; only fetch when we still have a weak fallback.
  if (!looksLikeFallback) return base;
  try {
    const url = metadataUrlForToken(base.tokenId);
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return base;
    const json = (await res.json()) as MetaJson;
    if (!json.image) return base;
    const image = ipfsToHttps(json.image);
    const identity = parseGenesisMetadataIdentity(json);
    return {
      ...base,
      image,
      side: identity?.side ?? base.side,
      gameplayClass: identity?.gameplayClass ?? base.gameplayClass,
      title: speciesClassLabel(
        identity?.side ?? base.side,
        identity?.gameplayClass ?? base.gameplayClass,
      ),
    };
  } catch {
    return base;
  }
}
