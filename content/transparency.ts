export type OfficialWalletLock = {
  readonly badge: string;
  readonly unlockDate: string;
  readonly lockedAt: string;
  readonly lockerName: string;
  readonly lockerAddress: string;
  readonly lockerExplorerUrl: string;
  readonly lockTxUrl: string;
};

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
  readonly lock?: OfficialWalletLock;
};

/**
 * Same 4 wallets used for UGLY DEER — no new wallets are created for the
 * HANSOME ALPACAS relaunch. Only the copy/token symbol changes; addresses
 * and roles (Deployment / Liquidity / Treasury / Founder) are reused as-is.
 *
 * Allocations below reflect the live on-chain state after the official
 * Uniswap v4 HANSOME/ETH pool was created (contract
 * 0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875, pool id
 * 0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d).
 *
 * Position NFT #47299 was locked on 2026-07-15 via TitanLockerManagerV2
 * (createPositionLock, tx 0x8ac188afa59c9bc26626bfec6977fbc25c294003d8761b2e41030ad0aab3bcf3),
 * unlocking 2027-07-15 03:38 UTC. It's no longer held directly by the
 * Treasury wallet — it's held by the lock contract until that date.
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
    allocation: "Initial LP deposit: 50,000,000 HANSOME + 0.075 ETH",
    address: "0x0bd54aeE53E9603375C27940d74e7c0923573b2a",
    explorerUrl:
      "https://robinhoodchain.blockscout.com/address/0x0bd54aeE53E9603375C27940d74e7c0923573b2a",
    liquidityDetail: "ETH / HANSOME · Fee: 0.05%",
    poolId: "0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d",
    positionNft: "#47299",
    lock: {
      badge: "🔒 Locked",
      unlockDate: "July 15, 2027 (UTC)",
      lockedAt: "July 15, 2026 (UTC)",
      lockerName: "TitanLockerManagerV2",
      lockerAddress: "0x26b0654A0756DCd036D4e7215324f3D2Be34D79e",
      lockerExplorerUrl:
        "https://robinhoodchain.blockscout.com/address/0x26b0654A0756DCd036D4e7215324f3D2Be34D79e",
      lockTxUrl:
        "https://robinhoodchain.blockscout.com/tx/0x8ac188afa59c9bc26626bfec6977fbc25c294003d8761b2e41030ad0aab3bcf3",
    },
    note: "The official Uniswap v4 liquidity position (Position NFT #47299) was locked on-chain via TitanLockerManagerV2 and unlocks July 15, 2027. It's held by that lock contract, not the Treasury wallet, until then — trading fees still flow to the Treasury while locked, but the underlying liquidity can't be withdrawn or modified until the unlock date. This Liquidity Wallet address itself may show zero HANSOME since the tokens are deposited into the pool rather than held directly.",
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
