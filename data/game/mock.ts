import type {
  GameDayState,
  LeaderboardEntry,
  MintSaleState,
  MockNft,
  RewardSummary,
  TerritoryStats,
  WalletUiState,
} from "@/types/game";

/** All values below are DEMO / MOCK — not live chain data. */
export const MOCK_BANNER = "DEMO DATA — not live blockchain state";

export function createMockDayState(now = Date.now()): GameDayState {
  const commitMs = 20 * 60 * 60 * 1000;
  const revealMs = 4 * 60 * 60 * 1000;
  // Demo: mid-commit window so Commit is active on first load
  const dayStart = now - 2 * 60 * 60 * 1000;
  return {
    day: 42,
    phase: "COMMIT",
    phaseEndsAt: dayStart + commitMs,
    commitEndsAt: dayStart + commitMs,
    revealEndsAt: dayStart + commitMs + revealMs,
    settled: false,
    settlementStatus: "Pending",
  };
}

export const MOCK_TERRITORY: TerritoryStats = {
  cougarsActive: 18,
  huntsToday: 7,
  huntPoolLabel: "40,000 HANSOME",
  territoryPressure: 64,
  alpacasActive: 126,
  survivalsToday: 98,
  baseRewardPoolLabel: "320,000 HANSOME",
  ranchActivity: 71,
};

export const MOCK_WALLET: WalletUiState = {
  connected: false,
  address: null,
  networkLabel: "ROBINHOOD CHAIN",
  isMock: true,
};

export const MOCK_MINT: MintSaleState = {
  collectionName: "HANSOME Genesis NFT",
  totalSupply: 550,
  alpacaCount: 500,
  cougarCount: 50,
  reservedCount: 10,
  whitelistCap: 100,
  publicCap: 440,
  minted: 128,
  phase: "Public",
  mintPriceLabel: "TBD",
  whitelistEligible: null,
  royaltyBps: 500,
  wlWalletMax: 1,
  publicWalletMax: 5,
  combinedWalletMax: 6,
};

export const MOCK_NFTS: MockNft[] = [
  {
    tokenId: 1,
    side: "Alpaca",
    gameplayClass: "King",
    revealed: true,
    image: "/assets/characters/alpaca-placeholder.svg",
    selectedLocationId: 0,
    claimableHansome: 1200,
    gameStatus: "Idle",
  },
  {
    tokenId: 14,
    side: "Alpaca",
    gameplayClass: "Farmer",
    revealed: true,
    image: "/assets/characters/alpaca-placeholder.svg",
    selectedLocationId: 3,
    claimableHansome: 420,
    gameStatus: "Committed",
  },
  {
    tokenId: 88,
    side: "Alpaca",
    gameplayClass: "Common",
    revealed: false,
    image: "/assets/ui/nft-unrevealed.svg",
    selectedLocationId: null,
    claimableHansome: 0,
    gameStatus: "Idle",
  },
  {
    tokenId: 501,
    side: "Cougar",
    gameplayClass: "None",
    revealed: true,
    image: "/assets/characters/cougar-placeholder.svg",
    selectedLocationId: 4,
    claimableHansome: 880,
    gameStatus: "Revealed",
  },
  {
    tokenId: 512,
    side: "Cougar",
    gameplayClass: "None",
    revealed: true,
    image: "/assets/characters/cougar-placeholder.svg",
    selectedLocationId: null,
    claimableHansome: 0,
    gameStatus: "Idle",
  },
];

export const MOCK_REWARDS: RewardSummary = {
  totalPending: 2500,
  claimable: 2500,
  alreadyClaimed: 18400,
  currentDayRewards: 0,
  treasuryAvailability: "Healthy",
  history: [
    { day: 41, amount: 960, side: "Alpaca", note: "Net after penalties (mock)" },
    { day: 41, amount: 420, side: "Cougar", note: "Base + hunt (mock)" },
    { day: 40, amount: 1100, side: "Alpaca", note: "Home safety (mock)" },
  ],
};

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, label: "Rancher#001", side: "Alpaca", score: 12840, earned: 42000 },
  { rank: 2, label: "Huntlord", side: "Cougar", score: 11220, earned: 51000 },
  { rank: 3, label: "FluffOps", side: "Alpaca", score: 9980, earned: 30100 },
  { rank: 4, label: "CliffStalker", side: "Cougar", score: 9100, earned: 38800 },
  { rank: 5, label: "PastureFox", side: "Alpaca", score: 8740, earned: 27600 },
];
