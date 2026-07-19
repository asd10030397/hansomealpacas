import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function installLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  const windowLike = { localStorage } as unknown as Window & typeof globalThis;
  vi.stubGlobal("window", windowLike);
  vi.stubGlobal("localStorage", localStorage);
  return store;
}

describe("game audio defaults", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults Music ON and SFX ON when no prefs are saved", async () => {
    installLocalStorage();
    const { loadAudioPreferences } = await import("@/lib/game/audio");
    expect(loadAudioPreferences()).toEqual({
      musicEnabled: true,
      sfxEnabled: true,
    });
  });

  it("respects previously saved Music/SFX preferences", async () => {
    installLocalStorage({
      "hansome-game-audio": JSON.stringify({
        musicEnabled: false,
        sfxEnabled: true,
      }),
    });
    const { loadAudioPreferences } = await import("@/lib/game/audio");
    expect(loadAudioPreferences()).toEqual({
      musicEnabled: false,
      sfxEnabled: true,
    });
  });
});
