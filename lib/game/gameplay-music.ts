/**
 * Gameplay BGM — battle-mode arrangement of the site HANSOME theme.
 * Does not replace /audio/ambient.wav (marketing site music).
 */

import {
  fadeOutAmbientSound,
  pauseAmbientSound,
} from "@/lib/ambient-sound";

export const GAMEPLAY_AUDIO = {
  themeOgg: "/audio/game/gameplay-theme.ogg",
  themeMp3: "/audio/game/gameplay-theme.mp3",
  phaseImpact: "/audio/game/phase-impact.ogg",
} as const;

/** Keep under site ambient (0.12) so UI / future SFX stay clear. */
const TARGET_VOLUME = 0.1;
const IMPACT_VOLUME = 0.16;
const FADE_IN_MS = 1600;
const FADE_OUT_MS = 1200;

let theme: HTMLAudioElement | null = null;
let impact: HTMLAudioElement | null = null;
let fadeFrame: number | null = null;
let mountCount = 0;
let unlockAttached = false;
let desiredPlaying = false;
let lastImpactPhase: string | null = null;

function cancelFade() {
  if (fadeFrame !== null) {
    cancelAnimationFrame(fadeFrame);
    fadeFrame = null;
  }
}

function fadeVolume(
  el: HTMLAudioElement,
  to: number,
  durationMs: number,
  onDone?: () => void,
) {
  cancelFade();
  const from = el.volume;
  const start = performance.now();

  const step = (now: number) => {
    const progress = Math.min((now - start) / durationMs, 1);
    el.volume = from + (to - from) * progress;
    if (progress < 1) {
      fadeFrame = requestAnimationFrame(step);
    } else {
      fadeFrame = null;
      onDone?.();
    }
  };

  fadeFrame = requestAnimationFrame(step);
}

function getTheme(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!theme) {
    theme = new Audio();
    theme.loop = true;
    theme.preload = "auto";
    theme.volume = 0;
    // Prefer Ogg; MP3 fallback for broader support.
    if (theme.canPlayType("audio/ogg") !== "") {
      theme.src = GAMEPLAY_AUDIO.themeOgg;
    } else {
      theme.src = GAMEPLAY_AUDIO.themeMp3;
    }
  }
  return theme;
}

function getImpact(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!impact) {
    impact = new Audio(GAMEPLAY_AUDIO.phaseImpact);
    impact.preload = "auto";
    impact.volume = IMPACT_VOLUME;
  }
  return impact;
}

function detachUnlock() {
  if (!unlockAttached) return;
  unlockAttached = false;
  document.removeEventListener("click", handleUnlock, true);
  document.removeEventListener("touchstart", handleUnlock, true);
  document.removeEventListener("keydown", handleUnlock, true);
}

function handleUnlock() {
  void startThemePlayback();
}

function attachUnlock() {
  if (unlockAttached) return;
  unlockAttached = true;
  document.addEventListener("click", handleUnlock, true);
  document.addEventListener("touchstart", handleUnlock, true);
  document.addEventListener("keydown", handleUnlock, true);
}

async function startThemePlayback(): Promise<boolean> {
  const el = getTheme();
  if (!el || !desiredPlaying) return false;

  // Hand off from marketing ambient.
  fadeOutAmbientSound(FADE_OUT_MS);
  pauseAmbientSound();

  try {
    if (el.paused) {
      el.volume = 0;
      await el.play();
    }
    detachUnlock();
    fadeVolume(el, document.hidden ? 0 : TARGET_VOLUME, FADE_IN_MS);
    return true;
  } catch {
    attachUnlock();
    return false;
  }
}

function stopThemePlayback() {
  const el = getTheme();
  if (!el) return;
  fadeVolume(el, 0, FADE_OUT_MS, () => {
    if (!desiredPlaying) {
      el.pause();
    }
  });
}

/** Enable / disable gameplay loop (respects user music toggle). */
export function setGameplayMusicEnabled(enabled: boolean): void {
  desiredPlaying = enabled;
  if (enabled) {
    void startThemePlayback();
  } else {
    detachUnlock();
    stopThemePlayback();
  }
}

/**
 * Play a short cinematic sting on Reveal / Settlement entry.
 * Skips repeat if the same phase is reported again.
 */
export function playPhaseImpact(phase: string): void {
  if (!desiredPlaying) return;
  if (phase !== "REVEAL" && phase !== "SETTLEMENT") return;
  if (lastImpactPhase === phase) return;
  lastImpactPhase = phase;

  const el = getImpact();
  if (!el) return;
  try {
    el.currentTime = 0;
    el.volume = IMPACT_VOLUME;
    void el.play();
  } catch {
    /* autoplay / unlock — ignore */
  }
}

export function resetPhaseImpactGate(): void {
  lastImpactPhase = null;
}

/**
 * Mount gameplay music session while /game is active.
 * Callers control playback via `setGameplayMusicEnabled`.
 */
export function mountGameplayMusic(): () => void {
  if (typeof window === "undefined") return () => {};

  mountCount += 1;
  fadeOutAmbientSound(FADE_OUT_MS);

  return () => {
    mountCount -= 1;
    if (mountCount <= 0) {
      desiredPlaying = false;
      detachUnlock();
      stopThemePlayback();
      resetPhaseImpactGate();
    }
  };
}

export function isGameplayMusicDesired(): boolean {
  return desiredPlaying;
}
