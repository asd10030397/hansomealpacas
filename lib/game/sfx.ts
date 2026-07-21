/**
 * Game SFX bus — low-level playback pool.
 * Callers must gate on sfxEnabled via `playSfx()` in audio.ts.
 */

export type SfxAssetId =
  | "ui-click"
  | "phase-impact"
  | "commit"
  | "reveal"
  | "claim"
  | "hunt"
  | "escape"
  | "shield"
  | "lucky";

const SFX_CACHE_VER = "ui-1";

export const SFX_ASSETS: Partial<
  Record<SfxAssetId, { ogg: string; mp3: string }>
> = {
  "ui-click": {
    ogg: `/audio/game/ui-click.ogg?v=${SFX_CACHE_VER}`,
    mp3: `/audio/game/ui-click.mp3?v=${SFX_CACHE_VER}`,
  },
  "phase-impact": {
    ogg: "/audio/game/phase-impact.ogg",
    mp3: "/audio/game/phase-impact.ogg",
  },
};

/** Global one-shot level — half of prior 0.35 so UI clicks are quieter. */
const SFX_VOLUME = 0.175;
const POOL_SIZE = 4;

const pools = new Map<string, HTMLAudioElement[]>();
const poolIndex = new Map<string, number>();

function pickSrc(asset: { ogg: string; mp3: string }): string {
  if (typeof Audio === "undefined") return asset.mp3;
  const probe = new Audio();
  return probe.canPlayType("audio/ogg") !== "" ? asset.ogg : asset.mp3;
}

function getPool(sfxId: SfxAssetId): HTMLAudioElement[] | null {
  if (typeof window === "undefined") return null;
  const asset = SFX_ASSETS[sfxId];
  if (!asset) return null;

  let pool = pools.get(sfxId);
  if (!pool) {
    const src = pickSrc(asset);
    pool = Array.from({ length: POOL_SIZE }, () => {
      const el = new Audio(src);
      el.preload = "auto";
      el.volume = SFX_VOLUME;
      return el;
    });
    pools.set(sfxId, pool);
    poolIndex.set(sfxId, 0);
  }
  return pool;
}

/** Play a one-shot (asset must exist). Prefer `playSfx()` for preference gating. */
export function playSfxNow(sfxId: SfxAssetId): void {
  const pool = getPool(sfxId);
  if (!pool || pool.length === 0) return;

  const i = poolIndex.get(sfxId) ?? 0;
  const el = pool[i % pool.length]!;
  poolIndex.set(sfxId, i + 1);

  el.volume = SFX_VOLUME;
  const start = () => {
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* not seekable yet */
    }
    void el.play().catch(() => {
      /* autoplay / interruption */
    });
  };

  if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    start();
  } else {
    el.addEventListener("canplay", start, { once: true });
    el.load();
  }
}

function eventTargetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  // Clicks on label text often hit a Text node — walk up to an Element.
  if (target instanceof Text) return target.parentElement;
  if (target instanceof Node) {
    return target.parentElement;
  }
  return null;
}

/**
 * True if the event target is an interactive control that should click-SFX.
 */
export function isSfxInteractiveTarget(target: EventTarget | null): boolean {
  const start = eventTargetElement(target);
  if (!start) return false;
  const el = start.closest(
    'button, a[href], [role="button"], input[type="button"], input[type="submit"]',
  );
  if (!el) return false;
  if (el.hasAttribute("data-no-sfx")) return false;
  if (el instanceof HTMLButtonElement && el.disabled) return false;
  if (el instanceof HTMLInputElement && el.disabled) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  return true;
}
