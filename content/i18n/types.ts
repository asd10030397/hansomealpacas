export type Locale = "zh" | "en";

export type GapAfter = "lg" | "md" | "none";

export type DeerVoteChoice = "one" | "three" | "five-plus";

export type DeerTrailItemId =
  | "website"
  | "community"
  | "deer-identity"
  | "token-launch"
  | "wallet-connect"
  | "claim-kairu"
  | "forest-grows"
  | "unknown";

export type DeerTrailItemCopy = {
  id: DeerTrailItemId;
  label: string;
};

export type AboutBlock = {
  lines: readonly string[];
  gapAfter: GapAfter;
};

export type DeerVoteOptionCopy = {
  id: DeerVoteChoice;
  display: string;
};

export type DeerVoteResultCopy = {
  heading: string;
  title: string;
  identity: string;
  flavor: string;
  shareLine: string;
  illustration: string;
};

export type Messages = {
  locale: Locale;
  htmlLang: string;
  language: {
    zh: string;
    en: string;
    toggleLabel: string;
  };
  a11y: {
    skipToContent: string;
    primaryLinks: string;
    socialLinks: string;
    mascotAlt: string;
    deerVoteGroup: string;
    copyContract: string;
    copiedContract: string;
    copyWebsite: string;
    shareDevice: string;
  };
  hero: {
    tagline: string;
    buy: string;
    chart: string;
    x: string;
    telegram: string;
  };
  about: {
    title: string;
    subtitle: string;
    blocks: readonly AboutBlock[];
  };
  deerVote: {
    title: string;
    reset: string;
    futureNote: {
      lead: string;
      emphasis: string;
    };
    shareRewardNotice: {
      followPrefix: string;
      followSuffix: string;
      shareLine: string;
      eligibilityLines: readonly string[];
    };
    claimProcessNote: {
      lead: string;
      submitLead: string;
      submitItems: readonly string[];
      verificationLines: readonly string[];
      footer: string;
    };
    tokenAbout: {
      solanaLabel: string;
      intro: string;
      beforeItems: readonly string[];
      utilityItems: readonly string[];
      afterItems: readonly string[];
      footer: string;
    };
    shareTagline: string;
    options: readonly DeerVoteOptionCopy[];
    results: Record<DeerVoteChoice, DeerVoteResultCopy>;
  };
  deerTrail: {
    title: string;
    caption: string;
    items: readonly DeerTrailItemCopy[];
  };
  contract: {
    title: string;
    comingSoon: string;
    copied: string;
    copy: string;
    shareOnX: string;
    copyUrl: string;
    copyCa: string;
    share: string;
    copyFailed: string;
  };
  footer: {
    tagline: string;
    copyright: string;
  };
};
