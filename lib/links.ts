import { PROJECT } from "@/content/project";

// Official HANSOME ALPACAS social accounts. Used as the fallback when
// NEXT_PUBLIC_X / NEXT_PUBLIC_TELEGRAM aren't set via env.
export const OFFICIAL_X_URL = "https://x.com/HansomeAlpacas";
export const OFFICIAL_X_HANDLE = "@HansomeAlpacas";
export const OFFICIAL_TELEGRAM_URL = "https://t.me/+3d5_qKK6V0cxNjM1";

export function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export function hasContractAddress(): boolean {
  return isValidAddress(PROJECT.contractAddress);
}

export function shortenContractAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export function getContractExplorerUrl(
  contractAddress: string,
  explorerBase?: string,
): string | undefined {
  const base = explorerBase?.trim().replace(/\/$/, "");
  if (!base || !isValidAddress(contractAddress)) return undefined;
  return `${base}/address/${contractAddress.trim()}`;
}

export type ProjectLinks = {
  website: string | undefined;
  twitter: string | undefined;
  telegram: string | undefined;
  chart: string | undefined;
  buy: string | undefined;
  contractAddress: string | null;
  explorer: string | undefined;
  network: string;
  isContractLive: boolean;
  isBuyEnabled: boolean;
  contractExplorerUrl: string | undefined;
};

export function getProjectLinks(): ProjectLinks {
  const buy = isValidHttpUrl(PROJECT.buyLink) ? PROJECT.buyLink.trim() : undefined;
  const explorer = isValidHttpUrl(PROJECT.explorer) ? PROJECT.explorer.trim() : undefined;
  const isContractLive = hasContractAddress();
  const contractAddress = isContractLive ? PROJECT.contractAddress.trim() : null;

  return {
    website: isValidHttpUrl(PROJECT.website) ? PROJECT.website.trim() : undefined,
    twitter: isValidHttpUrl(PROJECT.twitter) ? PROJECT.twitter.trim() : OFFICIAL_X_URL,
    telegram: isValidHttpUrl(PROJECT.telegram) ? PROJECT.telegram.trim() : OFFICIAL_TELEGRAM_URL,
    chart: isValidHttpUrl(PROJECT.chartLink) ? PROJECT.chartLink.trim() : undefined,
    buy,
    contractAddress,
    explorer,
    network: PROJECT.network.trim() || "Robinhood Chain",
    isContractLive,
    isBuyEnabled: Boolean(buy),
    contractExplorerUrl: contractAddress
      ? getContractExplorerUrl(contractAddress, explorer)
      : undefined,
  };
}

export type CommunityStatKey = "holders" | "transactions" | "liquidity" | "marketCap";

export type CommunityStat = {
  key: CommunityStatKey;
  value: string | null;
};

function readStatEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getCommunityStats(): CommunityStat[] {
  return [
    { key: "holders", value: readStatEnv("NEXT_PUBLIC_HOLDERS") },
    { key: "transactions", value: readStatEnv("NEXT_PUBLIC_TRANSACTIONS") },
    { key: "liquidity", value: readStatEnv("NEXT_PUBLIC_LIQUIDITY") },
    { key: "marketCap", value: readStatEnv("NEXT_PUBLIC_MARKET_CAP") },
  ];
}
