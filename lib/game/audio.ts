/**
 * Game audio preferences + channel facade.
 *
 * Channels (locked):
 * - music → gameplay battle-theme BGM only (`setGameplayMusicEnabled`)
 * - sfx   → all one-shots / UI / phase cues via `playSfx()` — never BGM
 *
 * UI click SFX uses `music/UI.wav` → `/audio/game/ui-click.*`.
 * Future: commit/reveal/claim/hunt/escape/shield/lucky/phase-impact.
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
  musicEnabled: false,
  /** On by default so button SFX are audible once the player interacts. */
  sfxEnabled: true,
};

export function loadAudioPreferences(): AudioPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveAudioPreferences(prefs: AudioPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  // Music only — never start SFX from preference save.
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
