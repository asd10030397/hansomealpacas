import { getCommunityStats, getProjectLinks } from "@/lib/links";

export const OFFICIAL_X_URL = "https://x.com/DeerloveRu";

export function getHeroActions() {
  const links = getProjectLinks();
  const swapHref = links.isContractLive ? "/swap" : links.isBuyEnabled ? links.buy : undefined;

  return {
    buy: {
      show: true,
      href: swapHref,
      disabled: !swapHref,
    },
    chart: {
      show: Boolean(links.chart),
      href: links.chart,
    },
    twitter: {
      show: Boolean(links.twitter),
      href: links.twitter,
    },
    telegram: {
      show: Boolean(links.telegram),
      href: links.telegram,
    },
  };
}

export function getContractState() {
  const links = getProjectLinks();

  return {
    address: links.contractAddress,
    isLive: links.isContractLive,
    explorerUrl: links.contractExplorerUrl,
  };
}

export function getShareState() {
  const links = getProjectLinks();

  return {
    websiteUrl: links.website,
    contractAddress: links.contractAddress,
  };
}

export function getSocialLinks() {
  const links = getProjectLinks();

  return {
    twitter: links.twitter ?? OFFICIAL_X_URL,
    telegram: links.telegram,
    website: links.website ?? "https://kairu.lol",
    explorer: links.explorer,
  };
}

export function getBuySectionState() {
  const links = getProjectLinks();

  if (links.isContractLive) {
    return {
      href: "/swap",
      comingSoon: false,
    };
  }

  return {
    href: links.isBuyEnabled ? links.buy : undefined,
    comingSoon: !links.isBuyEnabled,
  };
}

export function getLiveStatusState() {
  const links = getProjectLinks();

  return {
    network: links.network,
    isLive: links.isContractLive,
  };
}

export function getCommunityStatsState() {
  const links = getProjectLinks();

  return {
    isLive: links.isContractLive,
    stats: getCommunityStats(),
  };
}
