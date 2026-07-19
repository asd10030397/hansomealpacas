/**
 * Settlement result SFX — folder-backed one-shots. Gated by SFX toggle.
 * Missing / unsupported files fail silently.
 */

import { isSfxEnabled } from "@/lib/game/audio";
import {
  settlementResultSfxUrls,
  type SettlementResultSfxId,
} from "@/lib/game/settlementResults/catalog";

const VOLUME = 0.42;
const POOL_SIZE = 2;

const pools = new Map<SettlementResultSfxId, HTMLAudioElement[]>();
const poolIndex = new Map<SettlementResultSfxId, number>();
const unsupported = new Set<SettlementResultSfxId>();

function pickSrc(asset: { ogg: string; mp3: string }): string {
  if (typeof Audio === "undefined") return asset.mp3;
  const probe = new Audio();
  return probe.canPlayType("audio/ogg") !== "" ? asset.ogg : asset.mp3;
}

function getPool(id: SettlementResultSfxId): HTMLAudioElement[] | null {
  if (typeof window === "undefined") return null;
  if (unsupported.has(id)) return null;

  let pool = pools.get(id);
  if (!pool) {
    const src = pickSrc(settlementResultSfxUrls(id));
    pool = Array.from({ length: POOL_SIZE }, () => {
      const el = new Audio(src);
      el.preload = "auto";
      el.volume = VOLUME;
      el.addEventListener("error", () => {
        unsupported.add(id);
        pools.delete(id);
      });
      return el;
    });
    pools.set(id, pool);
    poolIndex.set(id, 0);
  }
  return pool;
}

/** @returns true if playback was attempted */
export function playSettlementResultSfx(id: SettlementResultSfxId): boolean {
  if (!isSfxEnabled()) return false;
  if (unsupported.has(id)) return false;

  const pool = getPool(id);
  if (!pool?.length) return false;

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
      unsupported.add(id);
    });
  };

  if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    start();
  } else {
    const onError = () => {
      unsupported.add(id);
    };
    el.addEventListener("error", onError, { once: true });
    el.addEventListener(
      "canplay",
      () => {
        el.removeEventListener("error", onError);
        start();
      },
      { once: true },
    );
    el.load();
  }
  return true;
}
