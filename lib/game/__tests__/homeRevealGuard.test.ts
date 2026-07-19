import { describe, expect, it } from "vitest";
import { isDefinitelyAlreadyRevealed } from "@/lib/game/homeRevealGuard";

describe("isDefinitelyAlreadyRevealed", () => {
  it("does not treat unrevealed default 0 as Home already revealed", () => {
    expect(
      isDefinitelyAlreadyRevealed({ locationOf: 0, commitLocationId: 0 }),
    ).toBe(false);
  });

  it("skips only when a non-zero location already matches", () => {
    expect(
      isDefinitelyAlreadyRevealed({ locationOf: 2, commitLocationId: 2 }),
    ).toBe(true);
    expect(
      isDefinitelyAlreadyRevealed({ locationOf: 0, commitLocationId: 2 }),
    ).toBe(false);
    expect(
      isDefinitelyAlreadyRevealed({ locationOf: 3, commitLocationId: 2 }),
    ).toBe(false);
  });
});
