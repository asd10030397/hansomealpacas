import { describe, expect, it } from "vitest";
import {
  ABILITY_EFFECT_IDS,
  parseAbilityEffectId,
  abilitySfxUrls,
} from "@/lib/game/abilityEffects/catalog";

describe("ability effect catalog", () => {
  it("parses ability labels to presentation ids", () => {
    expect(parseAbilityEffectId("Guardian — mitigation (mock)")).toBe("guardian");
    expect(parseAbilityEffectId("Runner — escape (mock)")).toBe("runner");
    expect(parseAbilityEffectId("Lucky — immunity (mock)")).toBe("lucky");
    expect(parseAbilityEffectId("Farmer — harvest (mock)")).toBe("farmer");
    expect(parseAbilityEffectId("Harvest Bonus!")).toBe("farmer");
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
});
