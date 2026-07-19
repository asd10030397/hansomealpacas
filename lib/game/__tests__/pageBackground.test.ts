import { describe, expect, it } from "vitest";
import {
  locationToPageBg,
  resolvePageBackground,
} from "@/lib/game/pageBackground";

describe("pageBackground", () => {
  it("maps locations", () => {
    expect(locationToPageBg(0)).toBe("home");
    expect(locationToPageBg(4)).toBe("river");
    expect(locationToPageBg(9)).toBeNull();
  });

  it("resolves routes (apex + pretty)", () => {
    expect(resolvePageBackground("/game/result")).toBe("battle");
    expect(resolvePageBackground("/result")).toBe("battle");
    expect(resolvePageBackground("/game/rewards")).toBe("reward");
    expect(resolvePageBackground("/rewards")).toBe("reward");
    expect(resolvePageBackground("/game/mint")).toBe("home");
    expect(resolvePageBackground("/game/my-nfts")).toBe("home");
    expect(resolvePageBackground("/game/dashboard")).toBe("world");
    expect(resolvePageBackground("/game/explore")).toBe("world");
    expect(resolvePageBackground("/game/explore", { locationId: 3 })).toBe(
      "forest",
    );
    expect(resolvePageBackground("/commit", { locationId: 1 })).toBe(
      "mountain",
    );
  });
});
