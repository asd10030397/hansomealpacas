import type { GameplayClass, NftSide } from "@/types/game";

/** HansomeTypes.Side */
export function mapSide(value: number): NftSide {
  if (value === 1) return "Alpaca";
  if (value === 2) return "Cougar";
  return "Unknown";
}

/** HansomeTypes.GameplayClass */
export function mapGameplayClass(value: number): GameplayClass {
  switch (value) {
    case 1:
      return "Common";
    case 2:
      return "Guardian";
    case 3:
      return "Farmer";
    case 4:
      return "Lucky";
    case 5:
      return "Runner";
    case 6:
      return "King";
    default:
      return "None";
  }
}

/** Human-readable ability label for inventory cards. */
export function abilityLabelFor(side: NftSide, cls: GameplayClass): string {
  if (side === "Cougar") return "Hunt";
  switch (cls) {
    case "King":
      return "Royal Immunity";
    case "Guardian":
      return "Guard";
    case "Farmer":
      return "Harvest Boost";
    case "Lucky":
      return "Lucky Escape";
    case "Runner":
      return "Sprint Escape";
    case "Common":
      return "Standard";
    default:
      return "—";
  }
}

/** Production GDS defaults (Mainnet). Testnet overrides via NEXT_PUBLIC_* after sync-game-env. */
export const PROD_DAY_LENGTH_SEC = 24 * 60 * 60;
export const PROD_COMMIT_DURATION_SEC = 20 * 60 * 60;
export const PROD_REVEAL_DURATION_SEC = 4 * 60 * 60;

function envPositiveInt(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Day length used by UI countdown when live chain timings are not yet hydrated. */
export const DAY_LENGTH_SEC =
  envPositiveInt("NEXT_PUBLIC_GAME_DAY_LENGTH_SEC") ?? PROD_DAY_LENGTH_SEC;
export const COMMIT_DURATION_SEC =
  envPositiveInt("NEXT_PUBLIC_GAME_COMMIT_DURATION_SEC") ?? PROD_COMMIT_DURATION_SEC;
export const REVEAL_DURATION_SEC =
  envPositiveInt("NEXT_PUBLIC_GAME_REVEAL_DURATION_SEC") ??
  Math.max(1, DAY_LENGTH_SEC - COMMIT_DURATION_SEC);

/** Production reveal metadata CID (Pinata). Override via env. */
export const GENESIS_METADATA_CID =
  process.env.NEXT_PUBLIC_GENESIS_METADATA_CID?.trim() ||
  "bafybeihs7d6nzeq2s6woads3bsbpwa5g4fgspz7fmtxr4wd6xh2idd224e";

export const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim() ||
  "https://gateway.pinata.cloud/ipfs/";

export function ipfsToHttps(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `${IPFS_GATEWAY.replace(/\/$/, "")}/${uri.slice("ipfs://".length)}`;
  }
  return uri;
}

export function metadataUrlForToken(tokenId: number): string {
  return `${IPFS_GATEWAY.replace(/\/$/, "")}/${GENESIS_METADATA_CID}/${tokenId}.json`;
}
