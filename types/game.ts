/** HANSOME game frontend types — mock-first; swap data source later. */

export type GamePhase = "COMMIT" | "REVEAL" | "SETTLEMENT" | "CLAIM";

export type NftSide = "Alpaca" | "Cougar" | "Unknown";

export type GameplayClass =
  | "None"
  | "Common"
  | "Guardian"
  | "Farmer"
  | "Lucky"
  | "Runner"
  | "King";

export type LocationId = 0 | 1 | 2 | 3 | 4;

export interface GameLocation {
  id: LocationId;
  /** Placeholder labels until world design is approved. */
  name: string;
  weight: 1 | 2 | 3 | 5 | 8;
  riskLabel: "None" | "Low" | "Medium" | "High" | "Extreme";
  /** Mock pressure 0–100. */
  pressure: number;
  alpacaAllowed: boolean;
  cougarAllowed: boolean;
  thumbnail: string;
}

export interface GameDayState {
  day: number;
  phase: GamePhase;
  /** Unix ms when current phase ends (demo countdown). */
  phaseEndsAt: number;
  commitEndsAt: number;
  revealEndsAt: number;
  settled: boolean;
  settlementStatus: "Pending" | "Ready" | "Complete";
}

export interface TerritoryStats {
  cougarsActive: number;
  huntsToday: number;
  huntPoolLabel: string;
  territoryPressure: number;
  alpacasActive: number;
  survivalsToday: number;
  baseRewardPoolLabel: string;
  ranchActivity: number;
}

export interface MockNft {
  tokenId: number;
  side: NftSide;
  gameplayClass: GameplayClass;
  revealed: boolean;
  image: string;
  selectedLocationId: LocationId | null;
  claimableHansome: number;
  gameStatus: "Idle" | "Committed" | "Revealed" | "Settled";
}

export interface MintSaleState {
  collectionName: string;
  totalSupply: number;
  alpacaCount: number;
  cougarCount: number;
  reservedCount: number;
  whitelistCap: number;
  publicCap: number;
  minted: number;
  phase: "Upcoming" | "Whitelist" | "Public" | "SoldOut";
  mintPriceLabel: string;
  whitelistEligible: boolean | null;
  royaltyBps: number;
  wlWalletMax: number;
  publicWalletMax: number;
  combinedWalletMax: number;
}

export interface RewardSummary {
  totalPending: number;
  claimable: number;
  alreadyClaimed: number;
  currentDayRewards: number;
  treasuryAvailability: "Healthy" | "Watch" | "SafeMode";
  history: { day: number; amount: number; side: NftSide; note: string }[];
}

export interface LeaderboardEntry {
  rank: number;
  label: string;
  side: NftSide;
  score: number;
  earned: number;
}

export interface WalletUiState {
  connected: boolean;
  address: string | null;
  /** Full checksum address when connected (live wallet). */
  fullAddress?: string | null;
  networkLabel: string;
  chainId?: number;
  wrongNetwork?: boolean;
  /** True only for placeholder mock wallet state. */
  isMock: boolean;
}
