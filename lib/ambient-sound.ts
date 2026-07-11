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
  void startPlayback();
}

function attachUnlockListeners() {
  if (unlockAttached) return;
  unlockAttached = true;
  document.addEventListener("click", handleUnlock, true);
  document.addEventListener("touchstart", handleUnlock, true);
  document.addEventListener("keydown", handleUnlock, true);
}

function onVisibilityChange() {
  if (!hasStarted) return;

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

export function mountAmbientSound(): () => void {
  if (typeof window === "undefined") return () => {};

  mountCount += 1;
  const instance = getAudio();
  if (!instance) return () => {};

  void startPlayback();

  return () => {
    mountCount -= 1;
    if (mountCount <= 0) {
      detachUnlockListeners();
    }
  };
}
