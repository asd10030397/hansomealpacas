import { ASSETS } from "@/content/project";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

const TARGET_VOLUME = 0.12;
const FADE_IN_MS = 2000;
const FADE_OUT_MS = 400;
const STORAGE_KEY = "hansomealpacas:ambient-started";

let audio: HTMLAudioElement | null = null;
let fadeFrame: number | null = null;
let hasStarted = false;
let unlockAttached = false;
let visibilityAttached = false;
let ambientTracked = false;
let mountCount = 0;
/** When true, marketing ambient must stay silent (Game section owns audio). */
let suppressedForGame = false;

function publishAudioDebug() {
  if (typeof window === "undefined") return;
  const prev = (window as Window & { __HANSOME_AUDIO__?: Record<string, unknown> })
    .__HANSOME_AUDIO__;
  (window as Window & { __HANSOME_AUDIO__?: Record<string, unknown> }).__HANSOME_AUDIO__ = {
    ...prev,
    ambient: {
      suppressed: suppressedForGame,
      paused: audio?.paused ?? true,
      volume: audio?.volume ?? 0,
      src: audio?.src ?? "",
      unlockAttached,
    },
  };
}

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;

  if (!audio) {
    audio = new Audio(ASSETS.ambient);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
  }

  return audio;
}

function cancelFade() {
  if (fadeFrame !== null) {
    cancelAnimationFrame(fadeFrame);
    fadeFrame = null;
  }
}

function fadeVolume(to: number, durationMs: number) {
  const instance = getAudio();
  if (!instance) return;

  cancelFade();

  const from = instance.volume;
  const start = performance.now();

  const step = (now: number) => {
    const progress = Math.min((now - start) / durationMs, 1);
    instance.volume = from + (to - from) * progress;

    if (progress < 1) {
      fadeFrame = requestAnimationFrame(step);
    } else {
      fadeFrame = null;
    }
  };

  fadeFrame = requestAnimationFrame(step);
}

function markStarted() {
  hasStarted = true;
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private browsing or blocked storage */
  }
}

function detachUnlockListeners() {
  if (!unlockAttached) return;
  unlockAttached = false;
  document.removeEventListener("click", handleUnlock, true);
  document.removeEventListener("touchstart", handleUnlock, true);
  document.removeEventListener("keydown", handleUnlock, true);
}

function handleUnlock() {
  if (suppressedForGame) {
    detachUnlockListeners();
    return;
  }
  void startPlayback();
}

function attachUnlockListeners() {
  if (suppressedForGame || unlockAttached) return;
  unlockAttached = true;
  document.addEventListener("click", handleUnlock, true);
  document.addEventListener("touchstart", handleUnlock, true);
  document.addEventListener("keydown", handleUnlock, true);
}

function onVisibilityChange() {
  if (suppressedForGame || !hasStarted) return;

  const instance = getAudio();
  if (!instance || instance.paused) return;

  if (document.hidden) {
    cancelFade();
    fadeVolume(0, FADE_OUT_MS);
    return;
  }

  fadeVolume(TARGET_VOLUME, FADE_IN_MS);
}

function attachVisibilityListener() {
  if (visibilityAttached) return;
  visibilityAttached = true;
  document.addEventListener("visibilitychange", onVisibilityChange);
}

async function startPlayback(): Promise<boolean> {
  if (suppressedForGame) {
    detachUnlockListeners();
    return false;
  }

  const instance = getAudio();
  if (!instance) return false;

  if (hasStarted && !instance.paused) {
    fadeVolume(document.hidden ? 0 : TARGET_VOLUME, FADE_IN_MS);
    return true;
  }

  try {
    if (instance.paused) {
      instance.volume = 0;
      await instance.play();
    }

    hasStarted = true;
    markStarted();
    const trigger = unlockAttached ? "interaction" : "autoplay";
    detachUnlockListeners();
    attachVisibilityListener();
    fadeVolume(document.hidden ? 0 : TARGET_VOLUME, FADE_IN_MS);

    if (!ambientTracked) {
      ambientTracked = true;
      trackEvent(AnalyticsEvents.AMBIENT_STARTED, { trigger });
    }

    return true;
  } catch {
    attachUnlockListeners();
    return false;
  }
}

/** True after the site ambient track has successfully started at least once. */
export function hasAmbientStarted(): boolean {
  return hasStarted;
}

export function isAmbientSuppressedForGame(): boolean {
  return suppressedForGame;
}

/** Fade site ambient toward silence (used when entering /game). */
export function fadeOutAmbientSound(durationMs = FADE_OUT_MS): void {
  const instance = getAudio();
  if (!instance) return;
  fadeVolume(0, durationMs);
}

/** Soften ambient without tearing down the element (game section takeover). */
export function pauseAmbientSound(): void {
  const instance = getAudio();
  if (!instance) return;
  cancelFade();
  fadeVolume(0, FADE_OUT_MS);
  window.setTimeout(() => {
    if (instance.volume < 0.01 && !instance.paused) {
      instance.pause();
    }
  }, FADE_OUT_MS + 40);
}

/**
 * Fully stop marketing ambient for the Game section.
 * Detaches unlock listeners so clicks cannot restart homepage BGM.
 */
export function stopAmbientSoundHard(): void {
  suppressedForGame = true;
  detachUnlockListeners();
  const instance = getAudio();
  if (!instance) {
    publishAudioDebug();
    return;
  }
  cancelFade();
  instance.volume = 0;
  if (!instance.paused) {
    instance.pause();
  }
  publishAudioDebug();
}

export function mountAmbientSound(): () => void {
  if (typeof window === "undefined") return () => {};

  suppressedForGame = false;
  mountCount += 1;
  const instance = getAudio();
  if (!instance) return () => {};

  void startPlayback().finally(() => publishAudioDebug());

  return () => {
    mountCount -= 1;
    if (mountCount <= 0) {
      detachUnlockListeners();
      // Leaving marketing pages — keep element warm but quiet if game takes over.
      fadeOutAmbientSound(FADE_OUT_MS);
      publishAudioDebug();
    }
  };
}
