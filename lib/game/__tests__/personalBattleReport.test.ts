import { describe, expect, it } from "vitest";
import { selectPersonalBattleTokenIds } from "@/lib/game/personalBattleReport";

const zero =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const hash =
  "0x1111111111111111111111111111111111111111111111111111111111111111" as const;

describe("selectPersonalBattleTokenIds", () => {
  it("only includes owned tokens with a commit hash for the day", () => {
    expect(
      selectPersonalBattleTokenIds({
        ownedTokenIds: [1, 11, 12, 14, 15, 16],
        commitHashes: [hash, zero, zero, hash, hash, zero],
      }),
    ).toEqual([1, 14, 15]);
  });

  it("does not include claimable-only / uncommitted owned NFTs", () => {
    expect(
      selectPersonalBattleTokenIds({
        ownedTokenIds: [11, 12, 13],
        commitHashes: [zero, zero, zero],
      }),
    ).toEqual([]);
  });

  it("merges wallet-scoped secrets but never other wallets' ids", () => {
    expect(
      selectPersonalBattleTokenIds({
        ownedTokenIds: [1, 15],
        commitHashes: [zero, zero],
        secretTokenIds: [1, 99],
      }),
    ).toEqual([1]);
  });
});
