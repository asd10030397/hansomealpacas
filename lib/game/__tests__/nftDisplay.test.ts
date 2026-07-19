import { describe, expect, it } from "vitest";
import {
  formatBattleRewardLabel,
  formatBattleStatus,
  shortAddress,
  speciesClassLabel,
} from "@/lib/game/nftDisplay";

describe("nftDisplay", () => {
  it("formats species/class titles", () => {
    expect(speciesClassLabel("Alpaca", "Runner")).toBe("Runner Alpaca");
    expect(speciesClassLabel("Alpaca", "King")).toBe("King Alpaca");
    expect(speciesClassLabel("Cougar", "None")).toBe("Cougar");
    expect(speciesClassLabel("Alpaca", "Common")).toBe("Common Alpaca");
  });

  it("formats status and rewards", () => {
    expect(formatBattleStatus("Escaped hunt")).toBe("Escaped");
    expect(formatBattleStatus("Hunt success")).toBe("Hunting Success");
    expect(formatBattleRewardLabel({ rewardLabel: "10,323 tHANSOME" })).toBe(
      "+10,323 tHANSOME",
    );
    expect(
      formatBattleRewardLabel({ rewardLabel: "0", missedReveal: true }),
    ).toBe("0 HANSOME");
  });

  it("shortens wallets", () => {
    expect(shortAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(
      "0x1234…5678",
    );
    expect(shortAddress(null)).toBe("—");
  });
});
