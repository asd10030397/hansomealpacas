/**
 * Game audio preferences + channel facade.
 *
 * Channels (locked):
 * - music → gameplay battle-theme BGM only (`setGameplayMusicEnabled`)
 * - sfx   → all one-shots / UI / phase cues via `playSfx()` — never BGM
 *
 * Defaults for new users (no saved prefs): Music ON, SFX ON.
 * Existing localStorage preferences are never overwritten on load.
 */

import { setGameplayMusicEnabled } from "@/lib/game/gameplay-music";
import { playSfxNow, type SfxAssetId } from "@/lib/game/sfx";

export type AudioChannel = "music" | "sfx";

export type SfxId = SfxAssetId | (string & {});

export interface AudioPreferences {
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

const STORAGE_KEY = "hansome-game-audio";

const DEFAULTS: AudioPreferences = {
  musicEnabled: true,
  sfxEnabled: true,
};

export function loadAudioPreferences(): AudioPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AudioPreferences>;
    return {
      musicEnabled:
        typeof parsed.musicEnabled === "boolean"
          ? parsed.musicEnabled
          : DEFAULTS.musicEnabled,
      sfxEnabled:
        typeof parsed.sfxEnabled === "boolean" ? parsed.sfxEnabled : DEFAULTS.sfxEnabled,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAudioPreferences(prefs: AudioPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  setGameplayMusicEnabled(prefs.musicEnabled);
}

export function isSfxEnabled(): boolean {
  return loadAudioPreferences().sfxEnabled;
}

export function playMusic(trackId: string): void {
  if (trackId === "gameplay" || trackId === "battle") {
    setGameplayMusicEnabled(true);
  }
}

/**
 * Play a one-shot sound effect. Always respects `sfxEnabled`.
 * Unknown / unwired IDs are silent (no placeholder beeps).
 */
export function playSfx(sfxId: SfxId): void {
  if (!isSfxEnabled()) return;
  playSfxNow(sfxId as SfxAssetId);
}

export function stopAllAudio(): void {
  setGameplayMusicEnabled(false);
}
