/**
 * Ability SFX — folder-backed one-shots. Gated by the game SFX toggle.
 * Does not touch gameplay BGM.
 */

import { isSfxEnabled } from "@/lib/game/audio";
import {
  abilitySfxUrls,
  type AbilityEffectId,
} from "@/lib/game/abilityEffects/catalog";

const VOLUME = 0.4;
const POOL_SIZE = 2;

const pools = new Map<AbilityEffectId, HTMLAudioElement[]>();
const poolIndex = new Map<AbilityEffectId, number>();

function pickSrc(asset: { ogg: string; mp3: string }): string {
  if (typeof Audio === "undefined") return asset.mp3;
  const probe = new Audio();
  return probe.canPlayType("audio/ogg") !== "" ? asset.ogg : asset.mp3;
}

function getPool(id: AbilityEffectId): HTMLAudioElement[] | null {
  if (typeof window === "undefined") return null;
  let pool = pools.get(id);
  if (!pool) {
    const src = pickSrc(abilitySfxUrls(id));
    pool = Array.from({ length: POOL_SIZE }, () => {
      const el = new Audio(src);
      el.preload = "auto";
      el.volume = VOLUME;
      return el;
    });
    pools.set(id, pool);
    poolIndex.set(id, 0);
  }
  return pool;
}

export function playAbilitySfx(id: AbilityEffectId): void {
  if (!isSfxEnabled()) return;
  const pool = getPool(id);
  if (!pool?.length) return;

  const i = poolIndex.get(id) ?? 0;
  const el = pool[i % pool.length]!;
  poolIndex.set(id, i + 1);

  el.volume = VOLUME;
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
