"use client";

import Link from "next/link";
import { MintPanel } from "@/components/mint/MintPanel";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";
import { enterGameHref } from "@/lib/game/uiLoopPhase";
import "@/styles/genesis-launch.css";

/**
 * Genesis Launch experience — collection rules, sale shape, and live mint panel.
 * Live price always comes from the deployed contract via MintPanel.
 */
export function GenesisLaunchPage() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const { phase } = useGameState();
  const L = t.launch;
  const enterHref = enterGameHref(phase, gameHref);

  return (
    <div className="genesis-launch">
      <header className="genesis-launch__hero">
        <div className="genesis-launch__hero-inner">
          <p className="genesis-launch__eyebrow">{L.eyebrow}</p>
          <h1 className="genesis-launch__title">{L.title}</h1>
          <p className="genesis-launch__lead">{L.lead}</p>
          <div className="genesis-launch__cta-row">
            <a
              href="#mint-action"
              className="pixel-title inline-flex flex-col items-center justify-center gap-1 border-[3px] border-[#9a6a12] bg-[#e8b03a] px-5 py-4 text-[0.7rem] text-[#1a1520] shadow-[3px_3px_0_0_#0a0c12] hover:bg-[#f0c44a]"
            >
              {L.ctaMint}
            </a>
            <PixelButton href={enterHref} variant="green" size="lg" className="w-auto">
              {L.ctaEnter}
            </PixelButton>
            <PixelButton href={gameHref.docs} variant="slate" size="lg" className="w-auto">
              {L.ctaDocs}
            </PixelButton>
          </div>
        </div>
      </header>

      <div className="genesis-launch__body">
        <div className="genesis-launch__grid-2">
          <PixelPanel title={L.collectionTitle}>
            <ul className="genesis-launch__list">
              {L.collectionRows.map(([label, value]) => (
                <li key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </li>
              ))}
            </ul>
            <p className="genesis-launch__note">{L.collectionNote}</p>
          </PixelPanel>

          <PixelPanel title={L.reservedTitle}>
            <ul className="genesis-launch__list">
              {L.reservedRows.map(([label, value]) => (
                <li key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </li>
              ))}
            </ul>
          </PixelPanel>
        </div>

        <PixelPanel title={L.saleTitle} eyebrow={L.saleEyebrow}>
          <ul className="genesis-launch__list">
            {L.saleRows.map(([label, value]) => (
              <li key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </li>
            ))}
          </ul>
          <p className="genesis-launch__note">{L.priceNote}</p>
        </PixelPanel>

        <PixelPanel title={L.cycleTitle}>
          <div className="genesis-launch__cycle">
            {L.cycleSteps.map(([step, hint]) => (
              <div key={step} className="genesis-launch__cycle-step">
                <strong>{step}</strong>
                <span>{hint}</span>
              </div>
            ))}
          </div>
          <p className="genesis-launch__note">{L.cycleNote}</p>
        </PixelPanel>

        <div className="genesis-launch__grid-2">
          <PixelPanel title={L.locationsTitle}>
            <ul className="genesis-launch__list">
              {L.locationRows.map(([label, value]) => (
                <li key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </li>
              ))}
            </ul>
            <p className="genesis-launch__note">{L.locationsNote}</p>
          </PixelPanel>

          <PixelPanel title={L.poolsTitle}>
            <div className="genesis-launch__pools">
              <div className="genesis-launch__pool">
                <strong>80%</strong>
                <span>{L.poolAlpaca}</span>
              </div>
              <div className="genesis-launch__pool">
                <strong>10%</strong>
                <span>{L.poolCougar}</span>
              </div>
              <div className="genesis-launch__pool">
                <strong>10%</strong>
                <span>{L.poolHunt}</span>
              </div>
            </div>
            <p className="genesis-launch__note">{L.poolsNote}</p>
          </PixelPanel>
        </div>

        <div id="mint-action" className="genesis-launch__mint-anchor">
          <MintPanel />
        </div>

        <p className="text-center text-xs text-[var(--hg-muted)]">
          <Link href={gameHref.home} className="underline decoration-[#f0c44a]/40 hover:text-[#f0c44a]">
            {L.backHome}
          </Link>
        </p>
      </div>
    </div>
  );
}
