import { describe, expect, it } from "vitest";
import { isGameAudioRoute, isGameInternalPath } from "@/lib/game/isGameChrome";

describe("isGameAudioRoute", () => {
  it("treats www /game/* as game audio", () => {
    expect(isGameInternalPath("/game")).toBe(true);
    expect(isGameAudioRoute("/game", "www.hansomealpacas.xyz")).toBe(true);
    expect(isGameAudioRoute("/game/dashboard", "hansomealpacas.xyz")).toBe(true);
    expect(isGameAudioRoute("/game/docs/guide", "localhost")).toBe(true);
  });

  it("does not treat marketing home as game audio on www", () => {
    expect(isGameAudioRoute("/", "www.hansomealpacas.xyz")).toBe(false);
    expect(isGameAudioRoute("/litepaper", "hansomealpacas.xyz")).toBe(false);
    expect(isGameAudioRoute("/swap", "localhost")).toBe(false);
  });

  it("treats entire game host as game audio (pretty URLs)", () => {
    expect(isGameAudioRoute("/", "game.hansomealpacas.xyz")).toBe(true);
    expect(isGameAudioRoute("/dashboard", "game.hansomealpacas.xyz")).toBe(true);
    expect(isGameAudioRoute("/my-nfts", "game.hansomealpacas.xyz")).toBe(true);
    expect(isGameAudioRoute("/docs", "game.localhost")).toBe(true);
  });
});
