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

/**
 * Short gameplay ability blurb (GDS / Player Guide).
 * Locale: "en" | "zh".
 */
export function abilityDescriptionFor(
  side: NftSide,
  cls: GameplayClass,
  locale: "en" | "zh" = "en",
): string {
  const zh = locale === "zh";
  if (side === "Cougar") {
    return zh
      ? "參與可狩獵地點；該地有任一羊駝時狩獵成功，可分得 Hunting Pool。"
      : "Join a huntable location. Succeed when any Alpaca is there — share the Hunting Pool.";
  }
  switch (cls) {
    case "King":
      return zh ? "永久免疫狩獵傷害。" : "Permanent immunity to hunting penalty.";
    case "Guardian":
      return zh ? "狩獵傷害降低 50%。" : "Hunting penalty rate reduced by 50%.";
    case "Farmer":
      return zh
        ? "所在地點收益權重 ×1.20（+20%，需歸一化）。"
        : "Effective location reward weight ×1.20 (+20%, normalized).";
    case "Lucky":
      return zh
        ? "20% 機率完全避免當日狩獵傷害。"
        : "20% chance to fully avoid the day's hunting penalty.";
    case "Runner":
      return zh
        ? "30% 機率逃離狩獵（傷害歸零）。"
        : "30% chance to escape hunting (penalty = 0).";
    case "Common":
      return zh
        ? "沒有特殊能力 — 靠地點策略取勝。"
        : "No special ability — win with location strategy.";
    default:
      return "—";
  }
}

/** Production GDS defaults (Mainnet). Testnet overrides via NEXT_PUBLIC_* after sync-game-env. */
export const PROD_DAY_LENGTH_SEC = 24 * 60 * 60;
export const PROD_COMMIT_DURATION_SEC = 20 * 60 * 60;
export const PROD_REVEAL_DURATION_SEC = 4 * 60 * 60;

/**
 * Static NEXT_PUBLIC reads so Next.js inlines them into the browser bundle.
 * Never use process.env[name] — dynamic keys are undefined client-side.
 */
function readPublicTimingSec(
  key:
    | "NEXT_PUBLIC_GAME_DAY_LENGTH_SEC"
    | "NEXT_PUBLIC_GAME_COMMIT_DURATION_SEC"
    | "NEXT_PUBLIC_GAME_REVEAL_DURATION_SEC",
): number | null {
  let raw = "";
  switch (key) {
    case "NEXT_PUBLIC_GAME_DAY_LENGTH_SEC":
      raw = process.env.NEXT_PUBLIC_GAME_DAY_LENGTH_SEC?.trim() || "";
      break;
    case "NEXT_PUBLIC_GAME_COMMIT_DURATION_SEC":
      raw = process.env.NEXT_PUBLIC_GAME_COMMIT_DURATION_SEC?.trim() || "";
      break;
    case "NEXT_PUBLIC_GAME_REVEAL_DURATION_SEC":
      raw = process.env.NEXT_PUBLIC_GAME_REVEAL_DURATION_SEC?.trim() || "";
      break;
  }
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Day length used by UI countdown when live chain timings are not yet hydrated. */
export const DAY_LENGTH_SEC =
  readPublicTimingSec("NEXT_PUBLIC_GAME_DAY_LENGTH_SEC") ?? PROD_DAY_LENGTH_SEC;
export const COMMIT_DURATION_SEC =
  readPublicTimingSec("NEXT_PUBLIC_GAME_COMMIT_DURATION_SEC") ??
  PROD_COMMIT_DURATION_SEC;
export const REVEAL_DURATION_SEC =
  readPublicTimingSec("NEXT_PUBLIC_GAME_REVEAL_DURATION_SEC") ??
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
