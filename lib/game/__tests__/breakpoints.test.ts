import { describe, expect, it } from "vitest";
import {
  GAME_DESKTOP_MIN_PX,
  GAME_MOBILE_MAX_PX,
  GAME_MOBILE_MEDIA,
} from "@/lib/game/breakpoints";

describe("game chrome breakpoints", () => {
  it("aligns header and dock on a single mobile max width", () => {
    expect(GAME_MOBILE_MAX_PX).toBe(1023);
    expect(GAME_DESKTOP_MIN_PX).toBe(1024);
    expect(GAME_MOBILE_MEDIA).toBe("(max-width: 1023px)");
  });
});
