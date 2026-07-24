"use client";

import Link from "next/link";
import { PixelPanel } from "@/components/ui/pixel";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { enterGameHref } from "@/lib/game/uiLoopPhase";
import { useGameState } from "@/hooks/game/useGameState";

export function SeasonIntro() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const { phase } = useGameState();
  const s = t.season;
  const playHref = enterGameHref(phase, gameHref);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-6">
      <header>
        <p className="mock-chip mb-2">{s.eyebrow}</p>
        <h1 className="pixel-title text-lg text-[#7ec8e8]">{s.heading}</h1>
        <p className="mt-2 text-sm text-[var(--hg-muted)]">{s.lead}</p>
      </header>

      <PixelPanel title={s.whatTitle} tone="alpaca">
        <p className="text-sm text-[#e8dfd2]">{s.whatBody}</p>
      </PixelPanel>

      <PixelPanel title={s.rosterTitle}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[240px] border-collapse text-left text-xs">
            <tbody>
              {s.rosterRows.map((row) => (
                <tr key={row[0]} className="border-b border-[#1a2030] text-[#e8dfd2]">
                  <td className="px-2 py-2 text-[var(--hg-muted)]">{row[0]}</td>
                  <td className="px-2 py-2">{row[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[#c4b8a4]">{s.rosterNote}</p>
      </PixelPanel>

      <PixelPanel title={s.loopTitle} eyebrow={s.loopEyebrow}>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--hg-muted)]">
          {s.loopSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-[#c4b8a4]">{s.loopNote}</p>
      </PixelPanel>

      <PixelPanel title={s.locationsTitle}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#2a3344] text-[var(--hg-muted)]">
                {s.locationHeaders.map((h) => (
                  <th key={h} className="px-2 py-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.locationRows.map((row) => (
                <tr key={row[0]} className="border-b border-[#1a2030] text-[#e8dfd2]">
                  {row.map((cell, i) => (
                    <td
                      key={`${row[0]}-${i}`}
                      className={`px-2 py-2 ${i === 0 ? "text-[var(--hg-muted)]" : ""}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[#c4b8a4]">{s.locationsNote}</p>
      </PixelPanel>

      <PixelPanel title={s.timingTitle}>
        <p className="text-sm text-[#e8dfd2]">{s.timingBody}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs text-[var(--hg-muted)]">
          {s.timingBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </PixelPanel>

      <PixelPanel title={s.futureTitle} tone="cougar">
        <p className="text-sm text-[#e8dfd2]">{s.futureBody}</p>
        <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-wider text-[#c4894a]">
          {s.futureEventDaysLabel}
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-[var(--hg-muted)]">
          {s.futureItems.map((item) => (
            <li key={item}>
              <span className="mr-1.5 inline-block rounded-none border border-[#c4894a]/60 bg-[#2a3348]/80 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-[#e8a070]">
                {t.common.soonBadge}
              </span>
              {item}
            </li>
          ))}
        </ul>
      </PixelPanel>

      <PixelPanel title={s.ctaTitle}>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href={gameHref.mint}
            className="pixel-border inline-flex min-h-[2.75rem] flex-1 items-center justify-center bg-[#e8b03a] px-4 py-2 text-center text-xs font-bold tracking-wider text-[#1a1520] no-underline hover:brightness-105"
          >
            {s.ctaMint}
          </Link>
          <Link
            href={playHref}
            className="pixel-border inline-flex min-h-[2.75rem] flex-1 items-center justify-center bg-[#3f9e4a] px-4 py-2 text-center text-xs font-bold tracking-wider text-[#f4ffe8] no-underline hover:brightness-105"
          >
            {s.ctaPlay}
          </Link>
          <Link
            href={gameHref.docs}
            className="pixel-border inline-flex min-h-[2.75rem] flex-1 items-center justify-center bg-[#1e2433] px-4 py-2 text-center text-xs font-bold tracking-wider text-[#f0c44a] no-underline hover:brightness-110"
          >
            {s.ctaDocs}
          </Link>
        </div>
        <p className="mt-3 text-xs text-[var(--hg-muted)]">
          <Link href={gameHref.home} className="text-[#f0c44a] underline">
            {s.backHome}
          </Link>
        </p>
      </PixelPanel>
    </div>
  );
}
