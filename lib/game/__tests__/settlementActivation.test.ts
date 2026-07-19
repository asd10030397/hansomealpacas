import { describe, expect, it } from "vitest";
import {
  deriveSettlementActivation,
  FARMER_PASSIVE_LABEL,
  farmerWeightInfluenced,
  prePenaltyBps,
  wasHunted,
} from "@/lib/game/settlementActivation";
import type { SettlementActivationFacts } from "@/lib/game/settlementActivation";

function alpaca(
  partial: Partial<SettlementActivationFacts> &
    Pick<SettlementActivationFacts, "gameplayClass" | "locationId">,
): SettlementActivationFacts {
  return {
    side: "Alpaca",
    adL: 1,
    cdL: 0,
    alpacaParticipantCount: 1,
    ...partial,
  };
}

describe("settlementActivation", () => {
  it("wasHunted requires cougars on a huntable location", () => {
    expect(wasHunted(0, 1, 2)).toBe(false);
    expect(wasHunted(1, 1, 0)).toBe(false);
    expect(wasHunted(1, 1, 1)).toBe(true);
    expect(prePenaltyBps(1, 1, 1)).toBeGreaterThan(0);
  });

  it("cougar: Hunt miss when no alpacas at location (Ad(L)=0)", () => {
    const miss = deriveSettlementActivation({
      side: "Cougar",
      gameplayClass: "Common",
      locationId: 2, // Grassland
      adL: 0,
      cdL: 1,
      alpacaParticipantCount: 3,
    });
    expect(miss.outcome).toMatch(/Hunt miss/i);
    expect(miss.abilityLabel).toMatch(/Empty/i);

    const hit = deriveSettlementActivation({
      side: "Cougar",
      gameplayClass: "Common",
      locationId: 2,
      adL: 1,
      cdL: 1,
      alpacaParticipantCount: 3,
    });
    expect(hit.outcome).toBe("Hunt success");
  });

  it("farmer weight only influences with ≥2 alpacas", () => {
    expect(farmerWeightInfluenced(1)).toBe(false);
    expect(farmerWeightInfluenced(2)).toBe(true);
  });

  it("not hunted → no hunt-reactive class FX", () => {
    for (const cls of ["Runner", "Lucky", "Guardian", "King", "Common"] as const) {
      const r = deriveSettlementActivation(
        alpaca({ gameplayClass: cls, locationId: 0, cdL: 5 }),
      );
      expect(r.activatedAbility).toBeNull();
      expect(r.outcome).toMatch(/Safe/);
    }
  });

  it("Farmer: always show passive identity (not a temporary proc)", () => {
    const alone = deriveSettlementActivation(
      alpaca({
        gameplayClass: "Farmer",
        locationId: 2,
        alpacaParticipantCount: 1,
      }),
    );
    expect(alone.activatedAbility).toBeNull();
    expect(alone.abilityLabel).toBe(FARMER_PASSIVE_LABEL);
    expect(alone.outcome).toMatch(/Safe/);

    const multi = deriveSettlementActivation(
      alpaca({
        gameplayClass: "Farmer",
        locationId: 2,
        alpacaParticipantCount: 3,
      }),
    );
    expect(multi.activatedAbility).toBeNull();
    expect(multi.abilityLabel).toBe(FARMER_PASSIVE_LABEL);

    const hunted = deriveSettlementActivation(
      alpaca({
        gameplayClass: "Farmer",
        locationId: 2,
        adL: 1,
        cdL: 1,
        alpacaParticipantCount: 4,
      }),
    );
    expect(hunted.outcome).toMatch(/Hunted/);
    expect(hunted.activatedAbility).toBeNull();
    expect(hunted.abilityLabel).toBe(FARMER_PASSIVE_LABEL);
  });

  it("runner: only on hunt + success", () => {
    const fail = deriveSettlementActivation(
      alpaca({
        gameplayClass: "Runner",
        locationId: 2,
        adL: 1,
        cdL: 1,
        runnerSuccess: false,
      }),
    );
    expect(fail.outcome).toMatch(/Hunted/);
    expect(fail.activatedAbility).toBeNull();

    const ok = deriveSettlementActivation(
      alpaca({
        gameplayClass: "Runner",
        locationId: 2,
        adL: 1,
        cdL: 1,
        runnerSuccess: true,
      }),
    );
    expect(ok.activatedAbility).toBe("runner");
    expect(ok.abilityLabel).toBe("Runner activated!");
    expect(ok.outcome).toMatch(/Escaped/);
  });

  it("lucky: only on hunt + success", () => {
    const fail = deriveSettlementActivation(
      alpaca({
        gameplayClass: "Lucky",
        locationId: 3,
        adL: 2,
        cdL: 1,
        luckySuccess: false,
      }),
    );
    expect(fail.activatedAbility).toBeNull();
    expect(fail.outcome).toMatch(/Hunted/);

    const ok = deriveSettlementActivation(
      alpaca({
        gameplayClass: "Lucky",
        locationId: 3,
        adL: 2,
        cdL: 1,
        luckySuccess: true,
      }),
    );
    expect(ok.activatedAbility).toBe("lucky");
    expect(ok.abilityLabel).toBe("Lucky activated!");
  });

  it("guardian: only when hunted and half-penalty applied", () => {
    const safe = deriveSettlementActivation(
      alpaca({ gameplayClass: "Guardian", locationId: 1, cdL: 0 }),
    );
    expect(safe.activatedAbility).toBeNull();

    const hit = deriveSettlementActivation(
      alpaca({ gameplayClass: "Guardian", locationId: 1, adL: 1, cdL: 1 }),
    );
    expect(hit.activatedAbility).toBe("guardian");
    expect(hit.outcome).toMatch(/Hunted/);
  });

  it("king: only when hunted and immunity zeros penalty", () => {
    const safe = deriveSettlementActivation(
      alpaca({ gameplayClass: "King", locationId: 0 }),
    );
    expect(safe.activatedAbility).toBeNull();

    const hit = deriveSettlementActivation(
      alpaca({ gameplayClass: "King", locationId: 4, adL: 1, cdL: 2 }),
    );
    expect(hit.activatedAbility).toBe("king");
    expect(hit.outcome).toMatch(/Survived/);
  });

  it("death: shared hunted outcome; no unique death proc FX", () => {
    for (const facts of [
      alpaca({
        gameplayClass: "Runner",
        locationId: 2,
        adL: 1,
        cdL: 1,
        runnerSuccess: false,
      }),
      alpaca({
        gameplayClass: "Lucky",
        locationId: 2,
        adL: 1,
        cdL: 1,
        luckySuccess: false,
      }),
      alpaca({
        gameplayClass: "Common",
        locationId: 2,
        adL: 1,
        cdL: 1,
      }),
    ] as SettlementActivationFacts[]) {
      const r = deriveSettlementActivation(facts);
      expect(r.outcome).toMatch(/Hunted/);
      expect(r.activatedAbility).toBeNull();
    }
  });
});
