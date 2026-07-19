"use client";

/**
 * DEV ONLY — King Alpaca promotional trailer for X / marketing.
 * Route: /dev/king-promo?autostart=1&record=1&silent=1
 * Optional: &aspect=9:16
 *
 * Message: King is a permanent legendary identity (not a random proc).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AbilityEffectOverlay } from "@/components/game/ability-effects/AbilityEffectOverlay";
import { loadAudioPreferences, saveAudioPreferences } from "@/lib/game/audio";
import "@/styles/game.css";
import "@/styles/game-polish.css";
import "./promo.css";

const KING_SRC = "/pixel/genesis/collection-550/image/1.png";
const COUGAR_SRC = "/pixel/cougar/mint/image/cougar.png";
const PREY_A = "/pixel/genesis/collection-550/image/100.png";
const PREY_B = "/pixel/genesis/collection-550/image/250.png";
const KING_BG = "/pixel/traits/backgrounds/king.png";
const PASTURE_BG = "/pixel/pasture-hero-bg.png";
const LOGO = "/logo/logo-512.png";

type SceneId = "intro" | "hunt" | "reveal" | "immunity" | "ending";

type Scene = {
  id: SceneId;
  durationMs: number;
  bg: string;
  bgTone: "royal" | "hunt";
  goldWash: boolean;
  showKing: boolean;
  showCougar: boolean;
  showPrey: boolean;
  kingClass: string;
  cougarClass: string;
  playKingFx: boolean;
  /** Marketing copy — never frames King as a random skill. */
  lines: string[];
  lineGold?: boolean;
};

/** Total ~24.5s (+ brief lead-in). Keep in sync with record/audio scripts. */
export const KING_PROMO_SCENES: Scene[] = [
  {
    id: "intro",
    durationMs: 4500,
    bg: KING_BG,
    bgTone: "royal",
    goldWash: true,
    showKing: true,
    showCougar: false,
    showPrey: false,
    kingClass: "king-promo__char--king-proud",
    cougarClass: "",
    playKingFx: true,
    lines: ["Not every Alpaca is born equal."],
  },
  {
    id: "hunt",
    durationMs: 4500,
    bg: PASTURE_BG,
    bgTone: "hunt",
    goldWash: false,
    showKing: false,
    showCougar: true,
    showPrey: true,
    kingClass: "",
    cougarClass: "king-promo__char--cougar-stalk",
    playKingFx: false,
    lines: ["Others become the hunted..."],
  },
  {
    id: "reveal",
    durationMs: 4000,
    bg: KING_BG,
    bgTone: "royal",
    goldWash: true,
    showKing: true,
    showCougar: true,
    showPrey: false,
    kingClass: "king-promo__char--king-stand",
    cougarClass: "",
    playKingFx: false,
    lines: ["But you..."],
    lineGold: true,
  },
  {
    id: "immunity",
    durationMs: 5500,
    bg: KING_BG,
    bgTone: "royal",
    goldWash: true,
    showKing: true,
    showCougar: false,
    showPrey: false,
    kingClass: "king-promo__char--king-stand",
    cougarClass: "",
    playKingFx: true,
    lines: [
      "Because you are HANSOME.",
      "You are the King.",
      "You cannot be hunted.",
    ],
    lineGold: true,
  },
  {
    id: "ending",
    durationMs: 5000,
    bg: KING_BG,
    bgTone: "royal",
    goldWash: true,
    showKing: false,
    showCougar: false,
    showPrey: false,
    kingClass: "",
    cougarClass: "",
    playKingFx: false,
    lines: [],
  },
];

const COPY_DELAY_MS = 420;
const FX_DELAY_MS = 700;
const CHAR_IN_MS = 80;

async function preload(urls: string[]) {
  await Promise.all(
    urls.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        }),
    ),
  );
}

type Phase = "boot" | "idle" | "playing" | "done";

export default function KingPromoPage() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [charsIn, setCharsIn] = useState(false);
  const [copyOn, setCopyOn] = useState(false);
  const [fxOn, setFxOn] = useState(false);
  const [fxKey, setFxKey] = useState(0);
  const [assetsReady, setAssetsReady] = useState(false);
  const [aspect, setAspect] = useState<"16:9" | "9:16">("16:9");
  const [recordMode, setRecordMode] = useState(false);
  const timers = useRef<number[]>([]);

  const scene = KING_PROMO_SCENES[sceneIndex] ?? null;

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("aspect") === "9:16") setAspect("9:16");
    if (params.get("record") === "1") setRecordMode(true);
    if (params.get("silent") === "1") {
      const prefs = loadAudioPreferences();
      saveAudioPreferences({ ...prefs, sfxEnabled: false, musicEnabled: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await preload([
        KING_SRC,
        COUGAR_SRC,
        PREY_A,
        PREY_B,
        KING_BG,
        PASTURE_BG,
        LOGO,
      ]);
      if (!cancelled) {
        setAssetsReady(true);
        setPhase("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runScene = useCallback(
    (index: number) => {
      clearTimers();
      const next = KING_PROMO_SCENES[index];
      if (!next) {
        setPhase("done");
        return;
      }
      setSceneIndex(index);
      setCharsIn(false);
      setCopyOn(false);
      setFxOn(false);
      setPhase("playing");

      schedule(() => setCharsIn(true), CHAR_IN_MS);
      schedule(() => setCopyOn(true), COPY_DELAY_MS);

      if (next.playKingFx) {
        schedule(() => {
          setFxKey((k) => k + 1);
          setFxOn(true);
        }, FX_DELAY_MS);
      }

      schedule(() => {
        if (index + 1 >= KING_PROMO_SCENES.length) {
          setPhase("done");
          return;
        }
        runScene(index + 1);
      }, next.durationMs);
    },
    [clearTimers, schedule],
  );

  const start = useCallback(() => {
    const prefs = loadAudioPreferences();
    const params = new URLSearchParams(window.location.search);
    const silent = params.get("silent") === "1";
    saveAudioPreferences({
      ...prefs,
      sfxEnabled: !silent,
      musicEnabled: false,
    });
    runScene(0);
  }, [runScene]);

  useEffect(() => {
    if (!assetsReady || phase !== "idle") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autostart") !== "1") return;
    const t = window.setTimeout(() => start(), 350);
    return () => window.clearTimeout(t);
  }, [assetsReady, phase, start]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Keep final frame on screen after the timeline completes (for recording hold).
  const showEnding =
    scene?.id === "ending" && (phase === "playing" || phase === "done");
  const playing =
    (phase === "playing" || phase === "done") && scene != null;

  const preloadUrls = useMemo(
    () => [KING_SRC, COUGAR_SRC, PREY_A, PREY_B, KING_BG, PASTURE_BG, LOGO],
    [],
  );

  return (
    <div
      className="hansome-game king-promo"
      data-testid="king-promo-root"
      data-phase={phase}
      data-scene={scene?.id ?? "none"}
      data-scene-index={sceneIndex}
      data-aspect={aspect}
      data-assets-ready={assetsReady ? "1" : "0"}
      data-done={phase === "done" ? "1" : "0"}
      data-record={recordMode ? "1" : "0"}
    >
      <div className="king-promo__preload" aria-hidden>
        {preloadUrls.map((src) => (
          <img key={src} src={src} alt="" />
        ))}
      </div>

      <div className="king-promo__frame" data-testid="king-promo-frame">
        {playing ? (
          <>
            <div
              key={`bg-${scene.id}`}
              className={`king-promo__bg king-promo__bg--on king-promo__bg--${scene.bgTone}`}
              style={{ backgroundImage: `url(${scene.bg})` }}
            />
            <div className="king-promo__vignette" />
            <div
              className={`king-promo__gold-wash${scene.goldWash ? " king-promo__gold-wash--on" : ""}`}
            />

            {showEnding ? (
              <div
                className={`king-promo__ending${charsIn || phase === "done" ? " king-promo__ending--on" : ""}`}
                data-testid="king-promo-ending"
              >
                <img
                  src={KING_SRC}
                  alt="King Alpaca"
                  className="king-promo__ending-hero"
                  draggable={false}
                />
                <img
                  src={LOGO}
                  alt="HANSOME"
                  className="king-promo__ending-logo"
                  width={112}
                  height={112}
                  draggable={false}
                />
                <h1 className="king-promo__ending-title">
                  HANSOME: Alpacas vs Cougars
                </h1>
                <p className="king-promo__ending-tag">Rule the game.</p>
                <p className="king-promo__ending-tag">Become the King.</p>
                <p className="king-promo__ending-rule">Legendary · Permanent Immunity</p>
              </div>
            ) : (
              <div className="king-promo__stage">
                <div className="king-promo__cast">
                  {scene.showPrey ? (
                    <img
                      src={PREY_A}
                      alt=""
                      className={`king-promo__char king-promo__char--prey king-promo__char--flee-left${charsIn ? " king-promo__char--in" : ""}`}
                      draggable={false}
                    />
                  ) : null}
                  {scene.showCougar && scene.id === "reveal" ? (
                    <img
                      src={COUGAR_SRC}
                      alt="Cougar"
                      className={`king-promo__char king-promo__char--cougar${charsIn ? " king-promo__char--in" : ""}`}
                      draggable={false}
                    />
                  ) : null}
                  {scene.showKing ? (
                    <div style={{ position: "relative" }}>
                      <img
                        src={KING_SRC}
                        alt="King Alpaca"
                        className={`king-promo__char king-promo__char--king ${scene.kingClass}${charsIn ? " king-promo__char--in" : ""}`}
                        data-testid="king-promo-king"
                        draggable={false}
                      />
                      <div
                        className={`king-promo__fx${fxOn ? " king-promo__fx--on" : ""}`}
                        data-testid="king-promo-fx"
                      >
                        {fxOn ? (
                          <AbilityEffectOverlay
                            key={`king-fx-${fxKey}`}
                            abilityId="king"
                            active
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {scene.showCougar && scene.id === "hunt" ? (
                    <img
                      src={COUGAR_SRC}
                      alt="Cougar"
                      className={`king-promo__char king-promo__char--cougar ${scene.cougarClass}${charsIn ? " king-promo__char--in" : ""}`}
                      data-testid="king-promo-cougar"
                      draggable={false}
                    />
                  ) : null}
                  {scene.showPrey ? (
                    <img
                      src={PREY_B}
                      alt=""
                      className={`king-promo__char king-promo__char--prey king-promo__char--flee-right${charsIn ? " king-promo__char--in" : ""}`}
                      draggable={false}
                    />
                  ) : null}
                </div>
              </div>
            )}

            {!showEnding && scene.lines.length > 0 ? (
              <div className="king-promo__copy">
                <p
                  className={`king-promo__line king-promo__line--stack${scene.lineGold ? " king-promo__line--gold" : ""}${copyOn ? " king-promo__line--on" : ""}`}
                  data-testid="king-promo-copy"
                >
                  {scene.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="king-promo__boot" data-testid="king-promo-boot">
            {phase === "boot" || !assetsReady
              ? "LOADING KING PROMO…"
              : phase === "done"
                ? "PROMO COMPLETE"
                : "KING PROMO READY"}
          </div>
        )}
      </div>

      {(phase === "idle" || phase === "done") && assetsReady && !recordMode ? (
        <button
          type="button"
          className="king-promo__start"
          data-testid="king-promo-start"
          onClick={start}
        >
          {phase === "done" ? "REPLAY" : "START KING PROMO"}
        </button>
      ) : null}
    </div>
  );
}
