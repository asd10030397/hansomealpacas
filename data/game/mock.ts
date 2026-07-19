import type {
  GameDayState,
  LeaderboardBoardId,
  LeaderboardEntry,
  MintSaleState,
  MockNft,
  RewardSummary,
  TerritoryStats,
  WalletUiState,
} from "@/types/game";

export type { LeaderboardBoardId };

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

/** Demo-only territory HUD figures — not protocol metrics. */
export const MOCK_TERRITORY: TerritoryStats = {
  cougarsActive: 18,
  huntsToday: 7,
  huntPoolLabel: "DEMO · Hunting Pool slice",
  territoryPressure: 64,
  alpacasActive: 126,
  survivalsToday: 98,
  alpacaPoolLabel: "DEMO · Alpaca Pool slice",
  ranchActivity: 71,
};

export const MOCK_WALLET: WalletUiState = {
  connected: false,
  address: null,
  networkLabel: "ROBINHOOD CHAIN",
  isMock: true,
};

/**
 * Fallback mint shape for offline demos only.
 * Live `/game/mint` reads price/supply/phase from the contract — do not treat this as chain state.
 */
export const MOCK_MINT: MintSaleState = {
  collectionName: "HANSOME Genesis NFT",
  totalSupply: 550,
  alpacaCount: 500,
  cougarCount: 50,
  reservedCount: 10,
  whitelistCap: 100,
  publicCap: 440,
  minted: 0,
  phase: "Upcoming",
  mintPriceLabel: "DEMO — read live price on-chain",
  whitelistEligible: null,
  royaltyBps: 500,
  wlWalletMax: 1,
  publicWalletMax: 5,
  combinedWalletMax: 6,
};

/**
 * Demo inventory only. Token IDs are arbitrary and must NOT imply side
 * (on-chain side is assigned at reveal; 501–550 is off-chain packaging only).
 */
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
    tokenId: 22,
    side: "Alpaca",
    gameplayClass: "Guardian",
    revealed: true,
    image: "/assets/characters/alpaca-placeholder.svg",
    selectedLocationId: 2,
    claimableHansome: 0,
    gameStatus: "Idle",
  },
  {
    tokenId: 36,
    side: "Alpaca",
    gameplayClass: "Runner",
    revealed: true,
    image: "/assets/characters/alpaca-placeholder.svg",
    selectedLocationId: 4,
    claimableHansome: 0,
    gameStatus: "Idle",
  },
  {
    tokenId: 40,
    side: "Alpaca",
    gameplayClass: "Lucky",
    revealed: true,
    image: "/assets/characters/alpaca-placeholder.svg",
    selectedLocationId: 1,
    claimableHansome: 0,
    gameStatus: "Idle",
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
    tokenId: 203,
    side: "Cougar",
    gameplayClass: "None",
    revealed: true,
    image: "/assets/characters/cougar-placeholder.svg",
    selectedLocationId: 4,
    claimableHansome: 880,
    gameStatus: "Revealed",
  },
  {
    tokenId: 317,
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
    { day: 41, amount: 960, side: "Alpaca", note: "Net after penalties (demo)" },
    { day: 41, amount: 420, side: "Cougar", note: "Cougar Base Pool + Hunting Pool (demo)" },
    { day: 40, amount: 1100, side: "Alpaca", note: "Home safety (demo)" },
  ],
};

/** Demo command-center figures — not live protocol data. */
export const MOCK_DASHBOARD = {
  seasonRank: 12,
  seasonRankOf: 48,
  nextSettlementLabel: "After Reveal Move",
};

/** Demo ranks only — gameplay metrics, never wallet balance. */
export const MOCK_LEADERBOARDS: Record<LeaderboardBoardId, LeaderboardEntry[]> = {
  season: [
    { rank: 1, label: "DemoRancher", side: "Alpaca", value: 1840, unit: "pts" },
    { rank: 2, label: "DemoHunter", side: "Cougar", value: 1720, unit: "pts" },
    { rank: 3, label: "DemoFluff", side: "Alpaca", value: 1510, unit: "pts" },
    { rank: 4, label: "DemoCliff", side: "Cougar", value: 1390, unit: "pts" },
    { rank: 5, label: "DemoPasture", side: "Alpaca", value: 1280, unit: "pts" },
  ],
  hunter: [
    { rank: 1, label: "DemoHunter", side: "Cougar", value: 42, unit: "hunts" },
    { rank: 2, label: "DemoCliff", side: "Cougar", value: 37, unit: "hunts" },
    { rank: 3, label: "DemoProwl", side: "Cougar", value: 31, unit: "hunts" },
    { rank: 4, label: "DemoRidge", side: "Cougar", value: 28, unit: "hunts" },
    { rank: 5, label: "DemoShade", side: "Cougar", value: 22, unit: "hunts" },
  ],
  survivor: [
    { rank: 1, label: "DemoFluff", side: "Alpaca", value: 38, unit: "days" },
    { rank: 2, label: "DemoRancher", side: "Alpaca", value: 35, unit: "days" },
    { rank: 3, label: "DemoPasture", side: "Alpaca", value: 33, unit: "days" },
    { rank: 4, label: "DemoMeadow", side: "Alpaca", value: 29, unit: "days" },
    { rank: 5, label: "DemoWool", side: "Alpaca", value: 27, unit: "days" },
  ],
  earnings: [
    { rank: 1, label: "DemoHunter", side: "Cougar", value: 51200, unit: "HANSOME" },
    { rank: 2, label: "DemoRancher", side: "Alpaca", value: 47800, unit: "HANSOME" },
    { rank: 3, label: "DemoCliff", side: "Cougar", value: 44100, unit: "HANSOME" },
    { rank: 4, label: "DemoFluff", side: "Alpaca", value: 39600, unit: "HANSOME" },
    { rank: 5, label: "DemoPasture", side: "Alpaca", value: 35200, unit: "HANSOME" },
  ],
};
