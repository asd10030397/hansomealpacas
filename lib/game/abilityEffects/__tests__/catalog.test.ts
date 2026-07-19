import { describe, expect, it } from "vitest";
import {
  ABILITY_EFFECT_IDS,
  parseAbilityEffectId,
  abilitySfxUrls,
} from "@/lib/game/abilityEffects/catalog";

describe("ability effect catalog", () => {
  it("parses activation labels only — not static inventory class fluff", () => {
    expect(parseAbilityEffectId("Guardian activated!")).toBe("guardian");
    expect(parseAbilityEffectId("Runner activated!")).toBe("runner");
    expect(parseAbilityEffectId("Lucky activated!")).toBe("lucky");
    expect(parseAbilityEffectId("King activated!")).toBe("king");
    expect(parseAbilityEffectId("Guardian — mitigation (mock)")).toBe("guardian");
    expect(parseAbilityEffectId("Runner — escape (mock)")).toBe("runner");
    expect(parseAbilityEffectId("Lucky — immunity (mock)")).toBe("lucky");

    // Static / passive identity — must NOT trigger proc FX
    expect(parseAbilityEffectId("Farmer · Harvest Boost")).toBeNull();
    expect(parseAbilityEffectId("Farmer activated!")).toBe("farmer"); // legacy string
    expect(parseAbilityEffectId("Lucky Escape")).toBeNull();
    expect(parseAbilityEffectId("Harvest Boost")).toBeNull();
    expect(parseAbilityEffectId("Sprint Escape")).toBeNull();
    expect(parseAbilityEffectId("Guard")).toBeNull();
    expect(parseAbilityEffectId("Royal Immunity")).toBeNull();
    expect(parseAbilityEffectId("Harvest Bonus!")).toBeNull();
    expect(parseAbilityEffectId(null)).toBeNull();
    expect(parseAbilityEffectId("—")).toBeNull();
  });

  it("maps each ability to folder-backed audio URLs", () => {
    for (const id of ABILITY_EFFECT_IDS) {
      const urls = abilitySfxUrls(id);
      expect(urls.ogg).toContain(`/audio/game/abilities/${id}/effect.ogg`);
      expect(urls.mp3).toContain(`/audio/game/abilities/${id}/effect.mp3`);
    }
  });

  it("King uses dedicated publicFolder king (not guardian reuse)", () => {
    expect(abilitySfxUrls("king").ogg).toContain("/abilities/king/effect.ogg");
  });
});
