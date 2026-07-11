import { getProjectLinks } from "@/lib/links";

export function getHeroActions() {
  const links = getProjectLinks();

  return {
    buy: {
      show: links.showBuy,
      href: links.isBuyEnabled ? links.buy : undefined,
      disabled: links.showBuy && !links.isBuyEnabled,
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
  };
}

export function getShareState() {
  const links = getProjectLinks();

  return {
    websiteUrl: links.website,
    contractAddress: links.contractAddress,
  };
}

export function getFooterLinks() {
  return getSocialLinks();
}

export function getSocialLinks() {
  const links = getProjectLinks();

  return {
    twitter: links.twitter ?? "https://x.com/UglyDeerSol",
    telegram: links.telegram ?? "#",
    website: links.website ?? "https://kairu.lol",
  };
}

export function getBuySectionState() {
  const links = getProjectLinks();

  return {
    href: links.isBuyEnabled ? links.buy : undefined,
    comingSoon: !links.isBuyEnabled,
  };
}
