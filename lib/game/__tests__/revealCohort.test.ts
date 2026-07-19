import { describe, expect, it } from "vitest";
import {
  alpacaCountAt,
  isCougarHuntSuccess,
  mergeOwnedRevealsIntoCohort,
  parseRevealCohort,
} from "@/lib/game/revealCohort";
import { deriveSettlementActivation } from "@/lib/game/settlementActivation";

/** Day 21 testnet: Mountain has only Cougar #30 — must be hunt miss. */
describe("revealCohort hunt success", () => {
  it("Day 21 solo wallet: Mountain Cougar with no Alpacas → hunt miss", () => {
    const cohort = parseRevealCohort([
      { args: { tokenId: 27n, locationId: 2, side: 1 } }, // Grassland Alpaca
      { args: { tokenId: 28n, locationId: 2, side: 1 } }, // Grassland Alpaca
      { args: { tokenId: 29n, locationId: 0, side: 1 } }, // Home Alpaca
      { args: { tokenId: 30n, locationId: 1, side: 2 } }, // Mountain Cougar
    ]);

    expect(alpacaCountAt(cohort, 1)).toBe(0); // Mountain
    expect(alpacaCountAt(cohort, 2)).toBe(2); // Grassland
    expect(isCougarHuntSuccess(1, alpacaCountAt(cohort, 1))).toBe(false);

    const outcome = deriveSettlementActivation({
      side: "Cougar",
      gameplayClass: "Common",
      locationId: 1,
      adL: alpacaCountAt(cohort, 1),
      cdL: 1,
      alpacaParticipantCount: cohort.alpacaParticipantCount,
    });
    expect(outcome.outcome).toMatch(/Hunt miss/i);
    expect(outcome.abilityLabel).toMatch(/Empty/i);
  });

  it("never invents Ad(L)=1 when cohort is empty", () => {
    const cohort = parseRevealCohort([]);
    expect(alpacaCountAt(cohort, 1)).toBe(0);
    expect(isCougarHuntSuccess(1, alpacaCountAt(cohort, 1))).toBe(false);
  });

  it("mergeOwnedReveals does not double-count chain logs", () => {
    const cohort = parseRevealCohort([
      { args: { tokenId: 30n, locationId: 1, side: 2 } },
    ]);
    const merged = mergeOwnedRevealsIntoCohort(cohort, [
      { tokenId: 30, locationId: 1, side: "Cougar" },
      { tokenId: 27, locationId: 2, side: "Alpaca" },
    ]);
    expect(merged.cd[1]).toBe(1);
    expect(merged.ad[2]).toBe(1);
  });

  it("hunt success only when any Alpaca shares the location", () => {
    const cohort = parseRevealCohort([
      { args: { tokenId: 1n, locationId: 1, side: 1 } },
      { args: { tokenId: 30n, locationId: 1, side: 2 } },
    ]);
    expect(isCougarHuntSuccess(1, alpacaCountAt(cohort, 1))).toBe(true);
  });
});
