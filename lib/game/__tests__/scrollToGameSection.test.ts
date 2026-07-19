/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GAME_SECTION_IDS,
  measureGameStickyOffset,
  scrollToGameSection,
} from "@/lib/game/scrollToGameSection";

describe("scrollToGameSection", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("exports stable section ids", () => {
    expect(GAME_SECTION_IDS.commit).toBe("commit-section");
    expect(GAME_SECTION_IDS.autoReveal).toBe("auto-reveal-section");
    expect(GAME_SECTION_IDS.battleResults).toBe("battle-results-section");
  });

  it("returns false when section missing", () => {
    expect(scrollToGameSection("missing-section")).toBe(false);
  });

  it("scrolls with sticky offset when section exists", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(200);

    const nav = document.createElement("div");
    nav.className = "hansome-game";
    const sticky = document.createElement("header");
    sticky.className = "game-nav";
    sticky.getBoundingClientRect = () =>
      ({
        height: 64,
        width: 390,
        top: 0,
        left: 0,
        bottom: 64,
        right: 390,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    nav.appendChild(sticky);

    const section = document.createElement("div");
    section.id = GAME_SECTION_IDS.commit;
    section.getBoundingClientRect = () =>
      ({
        height: 100,
        width: 390,
        top: 400,
        left: 0,
        bottom: 500,
        right: 390,
        x: 0,
        y: 400,
        toJSON: () => ({}),
      }) as DOMRect;

    document.body.appendChild(nav);
    document.body.appendChild(section);

    expect(measureGameStickyOffset()).toBe(72); // 64 + 8
    expect(scrollToGameSection(GAME_SECTION_IDS.commit)).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({
      top: 200 + 400 - 72,
      behavior: "smooth",
    });
  });
});
