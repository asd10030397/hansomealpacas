"use client";

import Link from "next/link";
import { PixelPanel } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { gameHref } from "@/lib/game/paths";

export default function GameDocsPage() {
  const { t } = useGameI18n();
  const d = t.docs;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-6">
      <header>
        <h1 className="pixel-title text-lg text-[#f0c44a]">{d.heading}</h1>
        <p className="mt-2 text-sm text-[var(--hg-muted)]">{d.blurb}</p>
      </header>

      <PixelPanel title={d.dailyLoopTitle}>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--hg-muted)]">
          {d.dailyLoopSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </PixelPanel>

      <PixelPanel title={d.poolsTitle}>
        <ul className="space-y-2 text-sm text-[var(--hg-muted)]">
          <li>{d.poolAlpaca}</li>
          <li>{d.poolCougarBase}</li>
          <li>{d.poolHunt}</li>
        </ul>
        <p className="mt-3 text-xs text-[#c4b8a4]">{d.poolPenaltyNote}</p>
      </PixelPanel>

      <PixelPanel title={d.sidesTitle}>
        <div className="grid gap-4 sm:grid-cols-2">
          <section>
            <h2 className="pixel-title text-sm text-[#f0c44a]">{d.alpacaTitle}</h2>
            <p className="mt-2 text-sm text-[#e8dfd2]">{d.alpacaGoal}</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-[var(--hg-muted)]">
              {d.alpacaPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="pixel-title text-sm text-[#e8a070]">{d.cougarTitle}</h2>
            <p className="mt-2 text-sm text-[#e8dfd2]">{d.cougarGoal}</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-[var(--hg-muted)]">
              {d.cougarPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        </div>
      </PixelPanel>

      <PixelPanel title={d.compareTitle}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#2a3344] text-[var(--hg-muted)]">
                {d.compareHeaders.map((h, i) => (
                  <th key={`h-${i}`} className="px-2 py-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.compareRows.map((row) => (
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
      </PixelPanel>

      <PixelPanel title={d.locationsTitle}>
        <p className="text-sm text-[var(--hg-muted)]">{d.locationsBody}</p>
      </PixelPanel>

      <PixelPanel title={d.moreTitle}>
        <p className="text-sm text-[var(--hg-muted)]">
          <Link
            href="/docs/HANSOME_Alpacas_Player_Guide_Bilingual.pdf"
            className="text-[#f0c44a] underline"
          >
            {d.playerGuide}
          </Link>
          {" · "}
          <Link href={gameHref.home} className="text-[#f0c44a] underline">
            {t.nav.home}
          </Link>
        </p>
        <p className="mt-2 text-xs text-[var(--hg-muted)]">{d.fullRulesNote}</p>
      </PixelPanel>
    </div>
  );
}
