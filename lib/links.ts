import { PROJECT } from "@/content/project";

export const OFFICIAL_X_URL = "https://x.com/DeerloveRu";
export const OFFICIAL_X_HANDLE = "@DeerloveRu";

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

export function hasContractAddress(): boolean {
  return PROJECT.contractAddress.trim().length > 0;
}

export function shortenContractAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export type ProjectLinks = {
  website: string | undefined;
  twitter: string | undefined;
  telegram: string | undefined;
  chart: string | undefined;
  buy: string | undefined;
  contractAddress: string | null;
  isContractLive: boolean;
  isBuyEnabled: boolean;
  showBuy: boolean;
};

export function getProjectLinks(): ProjectLinks {
  const buy = isValidHttpUrl(PROJECT.buyLink) ? PROJECT.buyLink.trim() : undefined;
  const isContractLive = hasContractAddress();

  return {
    website: isValidHttpUrl(PROJECT.website) ? PROJECT.website.trim() : undefined,
    twitter: isValidHttpUrl(PROJECT.twitter) ? PROJECT.twitter.trim() : OFFICIAL_X_URL,
    telegram: isValidHttpUrl(PROJECT.telegram) ? PROJECT.telegram.trim() : undefined,
    chart: isValidHttpUrl(PROJECT.chartLink) ? PROJECT.chartLink.trim() : undefined,
    buy,
    contractAddress: isContractLive ? PROJECT.contractAddress.trim() : null,
    isContractLive,
    isBuyEnabled: isContractLive && Boolean(buy),
    showBuy: Boolean(buy),
  };
}
