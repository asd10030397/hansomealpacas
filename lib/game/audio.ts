/**
 * Game audio preferences + thin facade.
 * Playback lives in `gameplay-music.ts` (battle theme) / future SFX bus.
 */

import { setGameplayMusicEnabled } from "@/lib/game/gameplay-music";

export type AudioChannel = "music" | "sfx";

export interface AudioPreferences {
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

const STORAGE_KEY = "hansome-game-audio";

const DEFAULTS: AudioPreferences = {
  musicEnabled: false,
  sfxEnabled: false,
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
  setGameplayMusicEnabled(prefs.musicEnabled);
}

export function playMusic(trackId: string): void {
  if (trackId === "gameplay" || trackId === "battle") {
    setGameplayMusicEnabled(true);
  }
}

export function playSfx(sfxId: string): void {
  void sfxId;
}

export function stopAllAudio(): void {
  setGameplayMusicEnabled(false);
}
