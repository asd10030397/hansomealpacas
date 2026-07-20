import { describe, expect, it } from "vitest";
import { battleResultViewDay } from "@/lib/game/battleResultViewDay";

describe("battleResultViewDay", () => {
  it("shows previous day during Commit", () => {
    expect(
      battleResultViewDay({ currentDay: 12, phase: "COMMIT" }),
    ).toBe(11);
  });

  it("shows current day during Reveal / Settlement / Claim", () => {
    expect(
      battleResultViewDay({ currentDay: 12, phase: "REVEAL" }),
    ).toBe(12);
    expect(
      battleResultViewDay({ currentDay: 12, phase: "SETTLEMENT" }),
    ).toBe(12);
    expect(
      battleResultViewDay({ currentDay: 12, phase: "CLAIM" }),
    ).toBe(12);
  });

  it("does not go negative on day 0 Commit", () => {
    expect(
      battleResultViewDay({ currentDay: 0, phase: "COMMIT" }),
    ).toBe(0);
  });
});
