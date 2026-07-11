export type OfficialWallet = {
  readonly id: string;
  readonly emoji: string;
  readonly title: string;
  readonly purpose: string;
  readonly allocation: string;
  readonly address: string;
  readonly explorerUrl: string;
  readonly note?: string;
  readonly liquidityDetail?: string;
};

/**
 * No contract or wallets have been deployed for HANSOME ALPACAS yet.
 * Fill this in with real addresses once the token is deployed and
 * liquidity is live — keep the same shape so WalletCard renders unchanged.
 */
export const OFFICIAL_WALLETS: readonly OfficialWallet[] = [] as const;

export const TOKEN_ALLOCATION = {
  liquidity: "TBD",
  treasury: "TBD",
  founder: "TBD",
  totalSupply: "1,000,000,000 HANSOME",
} as const;
