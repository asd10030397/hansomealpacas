/**
 * Audio manager placeholder — no audio playback yet.
 * Wire Music / SFX toggles here later (Web Audio / Howler / HTMLAudio).
 */

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
}

/** TODO: play BGM when musicEnabled && assets ready */
export function playMusic(trackId: string): void {
  void trackId;
}

/** TODO: play SFX when sfxEnabled && assets ready */
export function playSfx(sfxId: string): void {
  void sfxId;
}

export function stopAllAudio(): void {
  // intentionally empty
}
