"use client";

/**
 * DEV ONLY — Season 1 presentation showcase for social video.
 * Route: /dev/season1-showcase?autostart=1&record=1&silent=1
 *
 * Order per scene: NFT in → hold → FX + SFX → next.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AbilityEffectOverlay } from "@/components/game/ability-effects/AbilityEffectOverlay";
import { ResultEffectOverlay } from "@/components/game/result-effects/ResultEffectOverlay";
import {
  ABILITY_EFFECT_CATALOG,
  type AbilityEffectId,
} from "@/lib/game/abilityEffects";
import {
  SETTLEMENT_RESULT_SFX_CATALOG,
  type SettlementResultSfxId,
} from "@/lib/game/settlementResults";
import { loadAudioPreferences, saveAudioPreferences } from "@/lib/game/audio";
import "@/styles/game.css";
import "@/styles/game-polish.css";
import "./showcase.css";

type FxScene =
  | {
      kind: "ability";
      id: AbilityEffectId;
      tokenId: number;
      side: "Alpaca";
      title: string;
      subtitle: string;
    }
  | {
      kind: "result";
      id: SettlementResultSfxId;
      tokenId: number;
      side: "Alpaca" | "Cougar";
      title: string;
      subtitle: string;
    };

const FX_SCENES: FxScene[] = [
  {
    kind: "ability",
    id: "guardian",
    tokenId: 13,
    side: "Alpaca",
    title: "Guardian",
    subtitle: "Shield Activated",
  },
  {
    kind: "ability",
    id: "runner",
    tokenId: 8,
    side: "Alpaca",
    title: "Runner",
    subtitle: "Winged Escape",
  },
  {
    kind: "ability",
    id: "lucky",
    tokenId: 6,
    side: "Alpaca",
    title: "Lucky",
    subtitle: "Four-Leaf Clover",
  },
  {
    kind: "ability",
    id: "farmer",
    tokenId: 4,
    side: "Alpaca",
    title: "Farmer",
    subtitle: "Golden Harvest",
  },
  {
    kind: "result",
    id: "alpaca-hunted",
    tokenId: 100,
    side: "Alpaca",
    title: "Alpaca Hunted",
    subtitle: "Predator Slash",
  },
  {
    kind: "result",
    id: "alpaca-safe",
    tokenId: 250,
    side: "Alpaca",
    title: "Alpaca Safe",
    subtitle: "Safe & Sound",
  },
  {
    kind: "result",
    id: "cougar-hunt-success",
    tokenId: 501,
    side: "Cougar",
    title: "Cougar Hunt Success",
    subtitle: "Jaws Snap Shut",
  },
  {
    kind: "result",
    id: "cougar-hunt-failed",
    tokenId: 525,
    side: "Cougar",
    title: "Cougar Hunt Failed",
    subtitle: "Walk Away",
  },
];

/** Must match timing.mjs / build-season1-showcase-audio.mjs */
const NFT_ENTER_MS = 450;
const NFT_HOLD_MS = 500;
const FX_DELAY_MS = NFT_ENTER_MS + NFT_HOLD_MS; // 950
const GAP_MS = 320;
const ENDING_MS = 3400;

function nftSrc(tokenId: number) {
  return `/pixel/genesis/collection-550/image/${tokenId}.png`;
}

async function preloadNfts(ids: number[]) {
  await Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = nftSrc(id);
        }),
    ),
  );
}

type Phase = "boot" | "idle" | "fx" | "ending" | "done";

export default function Season1ShowcasePage() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [index, setIndex] = useState(0);
  const [fxActive, setFxActive] = useState(false);
  const [fxKey, setFxKey] = useState(0);
  const [nftIn, setNftIn] = useState(false);
  const [recordMode, setRecordMode] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const indexRef = useRef(0);
  const sceneAdvancedRef = useRef(false);

  const scene = FX_SCENES[index] ?? null;

  const goEnding = useCallback(() => {
    setFxActive(false);
    setNftIn(false);
    setPhase("ending");
    window.setTimeout(() => setPhase("done"), ENDING_MS);
  }, []);

  const start = useCallback(() => {
    if (!assetsReady) return;
    const prefs = loadAudioPreferences();
    const silent = new URLSearchParams(window.location.search).get("silent") === "1";
    saveAudioPreferences({
      ...prefs,
      sfxEnabled: !silent,
      musicEnabled: false,
    });
    indexRef.current = 0;
    sceneAdvancedRef.current = false;
    setIndex(0);
    setFxActive(false);
    setNftIn(false);
    setFxKey((k) => k + 1);
    setPhase("fx");
  }, [assetsReady]);

  // Preload all NFT art before any scene runs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await preloadNfts(FX_SCENES.map((s) => s.tokenId));
      // Warm decode
      await Promise.all(
        FX_SCENES.map(async (s) => {
          try {
            const res = await fetch(nftSrc(s.tokenId));
            await res.blob();
          } catch {
            /* ignore */
          }
        }),
      );
      if (!cancelled) {
        setAssetsReady(true);
        setPhase("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRecordMode(params.get("record") === "1");
  }, []);

  // Autostart only after assets ready
  useEffect(() => {
    if (!assetsReady) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autostart") !== "1") return;
    const t = window.setTimeout(() => start(), 400);
    return () => window.clearTimeout(t);
  }, [assetsReady, start]);

  const advanceAfterFx = useCallback(() => {
    if (sceneAdvancedRef.current) return;
    sceneAdvancedRef.current = true;
    setFxActive(false);
    const next = indexRef.current + 1;
    window.setTimeout(() => {
      if (next >= FX_SCENES.length) {
        goEnding();
        return;
      }
      indexRef.current = next;
      setIndex(next);
    }, GAP_MS);
  }, [goEnding]);

  // Scene mount: NFT in → hold → FX
  useEffect(() => {
    if (phase !== "fx" || !scene) return;
    sceneAdvancedRef.current = false;
    setFxActive(false);
    setNftIn(false);

    const enterT = window.setTimeout(() => setNftIn(true), 16);
    const fxT = window.setTimeout(() => {
      setFxKey((k) => k + 1);
      setFxActive(true);
    }, FX_DELAY_MS);

    // Safety: never hang the sequence if overlay onComplete is missed (HMR / tab freeze).
    const safetyMs = FX_DELAY_MS + 2200 + GAP_MS;
    const safetyT = window.setTimeout(() => {
      advanceAfterFx();
    }, safetyMs);

    return () => {
      window.clearTimeout(enterT);
      window.clearTimeout(fxT);
      window.clearTimeout(safetyT);
    };
  }, [phase, index, scene, advanceAfterFx]);

  const onFxComplete = useCallback(() => {
    advanceAfterFx();
  }, [advanceAfterFx]);

  const banner =
    scene?.kind === "ability"
      ? ABILITY_EFFECT_CATALOG[scene.id].banner
      : scene?.kind === "result"
        ? SETTLEMENT_RESULT_SFX_CATALOG[scene.id].banner
        : "";

  const showEnding = phase === "ending" || phase === "done";
  const showFx = phase === "fx" && scene != null;

  return (
    <div
      className="hansome-game s1-show"
      data-testid="s1-showcase-root"
      data-phase={phase}
      data-scene-index={index}
      data-assets-ready={assetsReady ? "1" : "0"}
      data-done={phase === "done" ? "1" : "0"}
      data-record={recordMode ? "1" : "0"}
      data-fx-active={fxActive ? "1" : "0"}
    >
      {/* Hidden preload rack — keeps decoded bitmaps warm */}
      <div className="s1-show__preload" aria-hidden>
        {FX_SCENES.map((s) => (
          <img key={s.tokenId} src={nftSrc(s.tokenId)} alt="" />
        ))}
      </div>

      <div className="s1-show__frame">
        <header className="s1-show__hud">
          <div className="s1-show__brand">
            <img
              src="/assets/ui/logo-hansome-game.svg"
              alt=""
              className="s1-show__logo-mark"
              width={36}
              height={36}
            />
            <div>
              <p className="s1-show__brand-name">HANSOME</p>
              <p className="s1-show__brand-sub">SEASON 1 · PRESENTATION</p>
            </div>
          </div>
          <div className="s1-show__phase">
            <span className="s1-show__phase-chip">SETTLEMENT</span>
            <span className="s1-show__phase-meta">DAY RESULTS</span>
          </div>
        </header>

        <main className="s1-show__stage" data-testid="s1-showcase-stage">
          {showEnding ? (
            <div className="s1-show__ending" data-testid="s1-showcase-ending">
              <img
                src="/logo/logo-light.svg"
                alt="HANSOME"
                className="s1-show__ending-logo"
              />
              <h1 className="s1-show__ending-title">
                HANSOME: Alpacas vs Cougars
              </h1>
              <p className="s1-show__ending-sub">Coming to Robinhood Chain</p>
            </div>
          ) : showFx ? (
            <div className="s1-show__card" key={`card-${index}`}>
              <div className="s1-show__nft-wrap">
                <img
                  src={nftSrc(scene.tokenId)}
                  alt={`Genesis #${scene.tokenId}`}
                  className={`s1-show__nft${nftIn ? " s1-show__nft--in" : ""}`}
                  data-testid="s1-showcase-nft"
                  draggable={false}
                />
                <div
                  className={`s1-show__fx${fxActive ? " s1-show__fx--on" : ""}`}
                  data-testid="s1-showcase-fx"
                >
                  {fxActive && scene.kind === "ability" ? (
                    <AbilityEffectOverlay
                      key={`ability-${scene.id}-${fxKey}`}
                      abilityId={scene.id}
                      active
                      onComplete={onFxComplete}
                    />
                  ) : null}
                  {fxActive && scene.kind === "result" ? (
                    <ResultEffectOverlay
                      key={`result-${scene.id}-${fxKey}`}
                      resultId={scene.id}
                      active
                      onComplete={onFxComplete}
                    />
                  ) : null}
                </div>
              </div>
              <div className={`s1-show__meta${nftIn ? " s1-show__meta--in" : ""}`}>
                <p className="s1-show__token">
                  #{scene.tokenId}
                  <span> · {scene.side}</span>
                </p>
                <h2 className="s1-show__title" data-testid="s1-showcase-title">
                  {scene.title}
                </h2>
                <p className="s1-show__subtitle">{scene.subtitle}</p>
                <p
                  className={`s1-show__banner${fxActive ? " s1-show__banner--on" : ""}`}
                  data-testid="s1-showcase-banner"
                >
                  {fxActive ? banner : "Ready"}
                </p>
              </div>
            </div>
          ) : (
            <div className="s1-show__idle">
              <p className="s1-show__idle-title">SEASON 1 SHOWCASE</p>
              <p className="s1-show__idle-sub">
                {phase === "boot" || !assetsReady
                  ? "Loading NFT artwork…"
                  : "8 presentation effects"}
              </p>
            </div>
          )}
        </main>

        <footer className="s1-show__footer">
          <p data-testid="s1-showcase-step">
            {showEnding
              ? "END TITLE"
              : showFx
                ? `${index + 1} / 8 · ${scene.title}`
                : phase === "boot"
                  ? "LOADING"
                  : "IDLE"}
          </p>
          <p className="s1-show__footer-right">Robinhood Chain</p>
        </footer>
      </div>

      {(phase === "idle" || phase === "done") && assetsReady ? (
        <button
          type="button"
          className="s1-show__start"
          data-testid="s1-showcase-start"
          onClick={start}
        >
          {phase === "done" ? "REPLAY" : "START SHOWCASE"}
        </button>
      ) : null}
    </div>
  );
}
