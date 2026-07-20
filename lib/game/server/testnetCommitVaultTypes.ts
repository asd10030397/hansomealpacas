import type { Hex } from "viem";

export type VaultCommitSecret = {
  tokenId: number;
  day: number;
  locationId: number;
  salt: Hex;
  commitHash: Hex;
  wallet: string;
  chainId: number;
  gameAddress: string;
  updatedAt: number;
};

export type VaultPersistInput = {
  tokenId: number;
  day: number;
  locationId: number;
  salt: Hex;
  commitHash: Hex;
  wallet: string;
  chainId?: number;
  gameAddress?: string;
};

export type StoredVaultRecord = {
  v: 1;
  chainId: number;
  gameAddress: string;
  wallet: string;
  day: number;
  tokenId: number;
  locationId: number;
  commitHash: Hex;
  iv: string;
  tag: string;
  ciphertext: string;
  updatedAt: number;
};

export type VaultKv = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  sadd: (key: string, member: string) => Promise<void>;
  smembers: (key: string) => Promise<string[]>;
};
