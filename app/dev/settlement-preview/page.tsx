"use client";

/**
 * DEV ONLY — Settlement result SFX + ability VFX/SFX preview.
 * Route: /dev/settlement-preview
 *
 * Uses production catalogs, AbilityEffectOverlay, playSettlementResultSfx,
 * and useSettlementPresentationQueue. No duplicated animation logic.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AbilityEffectOverlay } from "@/components/game/ability-effects/AbilityEffectOverlay";
import { ResultEffectOverlay } from "@/components/game/result-effects/ResultEffectOverlay";
import {
  useSettlementPresentationQueue,
  type SettlementPresentationRow,
} from "@/hooks/game/useSettlementPresentationQueue";
import {
  ABILITY_EFFECT_CATALOG,
  ABILITY_EFFECT_IDS,
  abilitySfxUrls,
  type AbilityEffectId,
} from "@/lib/game/abilityEffects";
import {
  loadAudioPreferences,
  saveAudioPreferences,
} from "@/lib/game/audio";
import {
  SETTLEMENT_RESULT_SFX_CATALOG,
  settlementResultSfxUrls,
  type SettlementResultSfxId,
} from "@/lib/game/settlementResults";

/** Authoritative outcome strings that production parseSettlementResultSfxId accepts. */
const RESULT_PRESETS: {
  id: SettlementResultSfxId;
  label: string;
  outcome: string;
}[] = [
  {
    id: "alpaca-hunted",
    label: "Alpaca Hunted",
    outcome: "Hunted — penalty applied",
  },
  {
    id: "alpaca-safe",
    label: "Alpaca Safe",
    outcome: "Safe (Home / no hunt)",
  },
  {
    id: "cougar-hunt-success",
    label: "Cougar Hunt Success",
    outcome: "Hunt success",
  },
  {
    id: "cougar-hunt-failed",
    label: "Cougar Hunt Failed",
    outcome: "Hunt miss",
  },
];

const ABILITY_PRESETS: {
  id: AbilityEffectId;
  label: string;
  ability: string;
}[] = ABILITY_EFFECT_IDS.map((id) => ({
  id,
  label: id.charAt(0).toUpperCase() + id.slice(1),
  ability: `${ABILITY_EFFECT_CATALOG[id].banner.replace(/!$/, "")} (preview)`,
}));

/** Combined demo: result first, then redesigned Runner (production queue order). */
const COMBINED_OUTCOME = "Escaped hunt";
const COMBINED_ABILITY = "Runner — escape (preview)";

type SoloMode =
  | { kind: "idle" }
  | { kind: "result"; id: SettlementResultSfxId }
  | { kind: "ability"; id: AbilityEffectId };

const btn =
  "border border-[#3a4560] bg-[#1a2233] px-3 py-2 text-left text-sm text-[#e8e4d8] hover:border-[#f0c44a] hover:text-[#f0c44a] disabled:opacity-40";
const btnActive = "border-[#f0c44a] text-[#f0c44a] bg-[#2a2410]";

export default function SettlementPreviewPage() {
  const [sfxOn, setSfxOn] = useState(true);
  const [forceReducedMotion, setForceReducedMotion] = useState(false);
  const [solo, setSolo] = useState<SoloMode>({ kind: "idle" });
  const [soloKey, setSoloKey] = useState(0);
  const [statusLine, setStatusLine] = useState("Idle");

  const [comboDay, setComboDay] = useState(900_001);
  const [comboToken, setComboToken] = useState(1);
  const [comboEnabled, setComboEnabled] = useState(false);
  const [comboRows, setComboRows] = useState<SettlementPresentationRow[]>([]);
  const lastAction = useRef<
    | { kind: "result"; id: SettlementResultSfxId }
    | { kind: "ability"; id: AbilityEffectId }
    | { kind: "combined" }
    | null
  >(null);

  useEffect(() => {
    const prefs = loadAudioPreferences();
    setSfxOn(prefs.sfxEnabled);
  }, []);

  const toggleSfx = () => {
    const prefs = loadAudioPreferences();
    const next = !prefs.sfxEnabled;
    saveAudioPreferences({ ...prefs, sfxEnabled: next });
    setSfxOn(next);
  };

  const stopAll = useCallback(() => {
    setSolo({ kind: "idle" });
    setComboEnabled(false);
    setComboRows([]);
    setStatusLine("Idle");
  }, []);

  const playResultSolo = useCallback(
    (id: SettlementResultSfxId) => {
      stopAll();
      lastAction.current = { kind: "result", id };
      setSolo({ kind: "result", id });
      setSoloKey((k) => k + 1);
      setStatusLine(`Result VFX + SFX: ${id}`);
    },
    [stopAll],
  );

  const playAbilitySolo = useCallback(
    (id: AbilityEffectId) => {
      stopAll();
      lastAction.current = { kind: "ability", id };
      setSolo({ kind: "ability", id });
      setSoloKey((k) => k + 1);
      setStatusLine(`Ability: ${id}`);
    },
    [stopAll],
  );

  const playCombined = useCallback(() => {
    setSolo({ kind: "idle" });
    lastAction.current = { kind: "combined" };
    // Unique token/day so session once-guards never block replay.
    const day = comboDay + 1;
    const tokenId = comboToken + 1;
    setComboDay(day);
    setComboToken(tokenId);
    setComboRows([
      {
        tokenId,
        outcome: COMBINED_OUTCOME,
        ability: COMBINED_ABILITY,
      },
    ]);
    setComboEnabled(true);
    setStatusLine("Combined queue: Result → Ability");
  }, [comboDay, comboToken]);

  const queue = useSettlementPresentationQueue(comboDay, comboRows, comboEnabled);

  useEffect(() => {
    if (!comboEnabled) return;
    if (queue.busy) return;
    if (queue.pendingCount === 0 && queue.current == null) {
      setComboEnabled(false);
      setStatusLine("Idle");
    }
  }, [comboEnabled, queue.busy, queue.pendingCount, queue.current]);

  const onOverlayComplete = useCallback(() => {
    if (solo.kind === "ability" || solo.kind === "result") {
      setSolo({ kind: "idle" });
      setStatusLine("Idle");
      return;
    }
    if (comboEnabled) {
      queue.advance();
    }
  }, [solo.kind, comboEnabled, queue]);

  const activeAbilityId =
    solo.kind === "ability"
      ? solo.id
      : (queue.currentAbility?.abilityId ?? null);

  const activeResultId =
    solo.kind === "result"
      ? solo.id
      : (queue.currentResult?.resultId ?? null);

  const playingName = useMemo(() => {
    if (queue.currentResult) {
      return `Result · ${queue.currentResult.resultId}`;
    }
    if (queue.currentAbility) {
      return `Ability · ${queue.currentAbility.abilityId}`;
    }
    if (solo.kind === "result") return `Result · ${solo.id}`;
    if (solo.kind === "ability") return `Ability · ${solo.id}`;
    return "—";
  }, [queue.currentResult, queue.currentAbility, solo]);

  const audioFile = useMemo(() => {
    if (queue.currentResult) {
      return settlementResultSfxUrls(queue.currentResult.resultId).ogg;
    }
    if (queue.currentAbility) {
      return abilitySfxUrls(queue.currentAbility.abilityId).ogg;
    }
    if (solo.kind === "result") return settlementResultSfxUrls(solo.id).ogg;
    if (solo.kind === "ability") return abilitySfxUrls(solo.id).ogg;
    return "—";
  }, [queue.currentResult, queue.currentAbility, solo]);

  const durationMs = useMemo(() => {
    if (queue.currentResult || solo.kind === "result") {
      const id = queue.currentResult?.resultId ?? (solo.kind === "result" ? solo.id : null);
      if (!id) return null;
      return forceReducedMotion ? 900 : SETTLEMENT_RESULT_SFX_CATALOG[id].durationMs;
    }
    if (queue.currentAbility) {
      return forceReducedMotion
        ? 900
        : ABILITY_EFFECT_CATALOG[queue.currentAbility.abilityId].durationMs;
    }
    if (solo.kind === "ability") {
      return forceReducedMotion
        ? 900
        : ABILITY_EFFECT_CATALOG[solo.id].durationMs;
    }
    return null;
  }, [queue.currentResult, queue.currentAbility, solo, forceReducedMotion]);

  const queueStatusLabel = comboEnabled
    ? `${queue.queueStatus}${queue.pendingCount ? ` · pending ${queue.pendingCount}` : ""}`
    : solo.kind === "idle"
      ? "idle"
      : `solo:${solo.kind}`;

  const replay = () => {
    const last = lastAction.current;
    if (!last || last.kind === "combined") {
      playCombined();
      return;
    }
    if (last.kind === "result") {
      playResultSolo(last.id);
      return;
    }
    playAbilitySolo(last.id);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-[family-name:var(--font-anton)] text-sm tracking-wide text-[#f0c44a]">
        SETTLEMENT PRESENTATION PREVIEW
      </h1>
      <p className="mt-2 text-sm text-[#8b93a7]">
        Production catalogs + overlays + shared queue. Result buttons play result
        VFX + SFX; ability buttons play ability VFX/SFX. Combined uses{" "}
        <code className="text-[#c8c4b8]">useSettlementPresentationQueue</code>{" "}
        (Result → Ability).
      </p>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${btn} ${sfxOn ? btnActive : ""}`}
          onClick={toggleSfx}
          data-testid="dev-sfx-toggle"
        >
          SFX: {sfxOn ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          className={`${btn} ${forceReducedMotion ? btnActive : ""}`}
          onClick={() => setForceReducedMotion((v) => !v)}
          data-testid="dev-reduced-motion"
        >
          Reduced motion preview: {forceReducedMotion ? "ON" : "OFF"}
        </button>
        <button type="button" className={btn} onClick={replay} data-testid="dev-replay">
          Replay
        </button>
        <button type="button" className={btn} onClick={stopAll}>
          Stop
        </button>
      </div>

      {/* Status panel */}
      <dl className="mt-4 grid gap-2 border border-[#2a3348] bg-[#121826] p-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-[#8b93a7]">Currently playing</dt>
          <dd className="mt-0.5 text-[#f0c44a]" data-testid="dev-playing-name">
            {playingName}
          </dd>
        </div>
        <div>
          <dt className="text-[#8b93a7]">Audio file</dt>
          <dd className="mt-0.5 break-all text-[#c8c4b8]" data-testid="dev-audio-file">
            {audioFile}
          </dd>
        </div>
        <div>
          <dt className="text-[#8b93a7]">Duration</dt>
          <dd className="mt-0.5" data-testid="dev-duration">
            {durationMs != null ? `${durationMs} ms` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[#8b93a7]">Queue status</dt>
          <dd className="mt-0.5" data-testid="dev-queue-status">
            {queueStatusLabel}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[#8b93a7]">Status</dt>
          <dd className="mt-0.5">{statusLine}</dd>
        </div>
      </dl>

      {/* Stage */}
      <div
        className="relative mt-4 min-h-[12rem] overflow-hidden border-2 border-[#2a3348] bg-[#0e1420]"
        data-testid="dev-settlement-stage"
      >
        <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 px-4 py-8">
          <div className="flex h-20 w-20 items-center justify-center border border-[#3a4560] bg-[#1a2233] text-[0.65rem] text-[#8b93a7]">
            NFT
          </div>
        </div>
        {activeResultId ? (
          <ResultEffectOverlay
            key={`result-${soloKey}-${activeResultId}-${forceReducedMotion ? "rm" : "full"}`}
            resultId={activeResultId}
            active
            forceReducedMotion={forceReducedMotion}
            onComplete={onOverlayComplete}
          />
        ) : null}
        {activeAbilityId ? (
          <AbilityEffectOverlay
            key={`ability-${soloKey}-${activeAbilityId}-${forceReducedMotion ? "rm" : "full"}`}
            abilityId={activeAbilityId}
            active
            forceReducedMotion={forceReducedMotion}
            onComplete={onOverlayComplete}
          />
        ) : null}
      </div>

      {/* Result buttons */}
      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-wider text-[#8b93a7]">
          Settlement Result Preview
        </h2>
        <p className="mt-1 text-xs text-[#6b7388]">
          Result VFX + SFX only — no ability cue.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {RESULT_PRESETS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`${btn} ${solo.kind === "result" && solo.id === r.id ? btnActive : ""}`}
              onClick={() => playResultSolo(r.id)}
              data-testid={`dev-result-${r.id}`}
            >
              <span className="block font-medium">{r.label}</span>
              <span className="mt-0.5 block text-[0.65rem] text-[#8b93a7]">
                {SETTLEMENT_RESULT_SFX_CATALOG[r.id].durationMs}ms ·{" "}
                {settlementResultSfxUrls(r.id).ogg.split("?")[0]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Ability buttons */}
      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-wider text-[#8b93a7]">
          Ability Preview
        </h2>
        <p className="mt-1 text-xs text-[#6b7388]">
          Ability VFX + SFX only (includes redesigned Runner winged shoes).
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ABILITY_PRESETS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`${btn} ${solo.kind === "ability" && solo.id === a.id ? btnActive : ""}`}
              onClick={() => playAbilitySolo(a.id)}
              data-testid={`dev-ability-${a.id}`}
            >
              <span className="block font-medium">{a.label}</span>
              <span className="mt-0.5 block text-[0.65rem] text-[#8b93a7]">
                {ABILITY_EFFECT_CATALOG[a.id].banner} ·{" "}
                {ABILITY_EFFECT_CATALOG[a.id].durationMs}ms
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Combined */}
      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-wider text-[#8b93a7]">
          Combined (production queue)
        </h2>
        <p className="mt-1 text-xs text-[#6b7388]">
          Order:{" "}
          <strong className="text-[#c8c4b8]">Result VFX/SFX → Ability VFX/SFX</strong>{" "}
          via shared queue. Demo: “{COMBINED_OUTCOME}” → Runner.
        </p>
        <button
          type="button"
          className={`${btn} mt-2 w-full ${btnActive}`}
          onClick={playCombined}
          data-testid="dev-preview-combined"
        >
          Preview Combined
        </button>
      </section>
    </div>
  );
}
