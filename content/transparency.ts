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
  readonly poolId?: string;
  readonly positionNft?: string;
};

/**
 * Same 4 wallets used for UGLY DEER — no new wallets are created for the
 * HANSOME ALPACAS relaunch. Only the copy/token symbol changes; addresses
 * and roles (Deployment / Liquidity / Treasury / Founder) are reused as-is.
 *
 * Allocations below reflect the live on-chain state after the official
 * Uniswap v4 HANSOME/ETH pool was created (contract
 * 0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875, pool id
 * 0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d,
 * Position NFT #47299 owned by the Treasury wallet).
 */
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
    allocation: "Locked LP — 50,000,000 HANSOME + 0.075 ETH",
    address: "0x0bd54aeE53E9603375C27940d74e7c0923573b2a",
    explorerUrl:
      "https://robinhoodchain.blockscout.com/address/0x0bd54aeE53E9603375C27940d74e7c0923573b2a",
    liquidityDetail: "ETH / HANSOME · Fee: 0.05%",
    poolId: "0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d",
    positionNft: "#47299",
    note: "The official Uniswap v4 liquidity position (Position NFT #47299) is held by the Treasury wallet. This Liquidity Wallet address may show zero HANSOME since the tokens are deposited into the pool rather than held directly.",
  },
  {
    id: "treasury",
    emoji: "🏛",
    title: "Treasury",
    purpose:
      "Treasury, ecosystem growth, partnerships, future liquidity, marketing and development.",
    allocation: "900,000,000 HANSOME (90%)",
    address: "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A",
    explorerUrl:
      "https://robinhoodchain.blockscout.com/address/0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A",
  },
  {
    id: "founder",
    emoji: "🦙",
    title: "Founder Wallet",
    purpose: "Founder allocation.",
    allocation: "50,000,000 HANSOME (5%)",
    address: "0x2006CF012842e757f1f79938cD646e8a19d5c389",
    explorerUrl:
      "https://robinhoodchain.blockscout.com/address/0x2006CF012842e757f1f79938cD646e8a19d5c389",
  },
] as const;

export const TOKEN_ALLOCATION = {
  liquidity: "50,000,000 HANSOME (5%)",
  treasury: "900,000,000 HANSOME (90%)",
  founder: "50,000,000 HANSOME (5%)",
  totalSupply: "1,000,000,000 HANSOME",
} as const;
