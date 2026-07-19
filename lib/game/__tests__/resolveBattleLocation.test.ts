import { describe, expect, it } from "vitest";
import { resolveBattleLocationId } from "@/lib/game/resolveBattleLocation";

describe("resolveBattleLocationId", () => {
  it("prefers Revealed-event cohort location over stale locationOf=0", () => {
    expect(
      resolveBattleLocationId({
        committed: true,
        revealed: true,
        settled: true,
        locationOf: 0,
        secretLocationId: 1,
        cohortLocationId: 2,
        side: "Alpaca",
      }),
    ).toBe(2);
  });

  it("uses secret when locationOf is still the unrevealed default 0", () => {
    expect(
      resolveBattleLocationId({
        committed: true,
        revealed: false,
        settled: false,
        locationOf: 0,
        secretLocationId: 3,
        side: "Alpaca",
      }),
    ).toBe(3);
  });

  it("never reports Home for a Cougar from locationOf=0 alone", () => {
    expect(
      resolveBattleLocationId({
        committed: true,
        revealed: true,
        settled: true,
        locationOf: 0,
        side: "Cougar",
      }),
    ).toBeNull();
  });

  it("allows Alpaca Home only after reveal/settle with no contradicting secret", () => {
    expect(
      resolveBattleLocationId({
        committed: true,
        revealed: true,
        settled: true,
        locationOf: 0,
        side: "Alpaca",
      }),
    ).toBe(0);
  });

  it("Day 11 regression: W2/W3 secrets must not collapse to Home", () => {
    // Matches on-chain Day 11 for #27–#30 when locationOf cache is still 0.
    expect(
      resolveBattleLocationId({
        committed: true,
        revealed: true,
        settled: true,
        locationOf: 0,
        secretLocationId: 2,
        side: "Cougar",
      }),
    ).toBe(2);
    expect(
      resolveBattleLocationId({
        committed: true,
        revealed: true,
        settled: true,
        locationOf: 0,
        secretLocationId: 1,
        side: "Alpaca",
      }),
    ).toBe(1);
  });
});
