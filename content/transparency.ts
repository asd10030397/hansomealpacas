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

export const OFFICIAL_WALLETS: readonly OfficialWallet[] = [
  {
    id: "deployment",
    emoji: "🚀",
    title: "Deployment Wallet",
    purpose: "Contract deployment and technical operations.",
    allocation: "0%",
    address: "0xfEff679d14f7D1a2F343095680430e4c96dE691F",
    explorerUrl:
      "https://robinhoodchain.blockscout.com/address/0xfEff679d14f7D1a2F343095680430e4c96dE691F",
  },
  {
    id: "liquidity",
    emoji: "💧",
    title: "Liquidity Wallet",
    purpose: "Official Uniswap v4 liquidity management.",
    allocation: "≈ 2.88%",
    address: "0x0bd54aeE53E9603375C27940d74e7c0923573b2a",
    explorerUrl:
      "https://robinhoodchain.blockscout.com/address/0x0bd54aeE53E9603375C27940d74e7c0923573b2a",
    liquidityDetail: "ETH / UGLY · Fee: 0.05%",
    note: "This wallet manages the official liquidity position. UGLY tokens are deposited into the Uniswap v4 pool, so the wallet balance may appear as zero.",
  },
  {
    id: "treasury",
    emoji: "🏛",
    title: "Treasury",
    purpose:
      "Treasury, ecosystem growth, partnerships, future liquidity, marketing and development.",
    allocation: "≈ 72.12%",
    address: "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A",
    explorerUrl:
      "https://robinhoodchain.blockscout.com/address/0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A",
  },
  {
    id: "founder",
    emoji: "🦌",
    title: "Founder Wallet",
    purpose: "Founder allocation.",
    allocation: "25.00%",
    address: "0x2006CF012842e757f1f79938cD646e8a19d5c389",
    explorerUrl:
      "https://robinhoodchain.blockscout.com/address/0x2006CF012842e757f1f79938cD646e8a19d5c389",
  },
] as const;

export const TOKEN_ALLOCATION = {
  liquidity: "2.88%",
  treasury: "72.12%",
  founder: "25.00%",
  totalSupply: "1,000,000,000 UGLY",
} as const;
