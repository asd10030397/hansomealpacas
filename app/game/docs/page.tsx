"use client";

import Link from "next/link";
import { PixelPanel } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { gameHref } from "@/lib/game/paths";

export default function GameDocsPage() {
  const { t } = useGameI18n();

  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      <p className="mock-chip mb-3">{t.common.demoBanner}</p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">{t.docs.heading}</h1>
      <p className="mt-2 text-sm text-[var(--hg-muted)]">{t.docs.blurb}</p>

      <PixelPanel className="mt-4" title="DAILY LOOP">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--hg-muted)]">
          <li>COMMIT — seal a location hash</li>
          <li>REVEAL — open location + salt</li>
          <li>SETTLEMENT — pools split 80 / 10 / 10</li>
          <li>CLAIM — pull HANSOME booked to your NFT</li>
        </ol>
      </PixelPanel>

      <PixelPanel className="mt-4" title="LOCATIONS">
        <p className="text-sm text-[var(--hg-muted)]">
          Placeholders until world design approval: Home, Location 1–4. Weights: 1 / 2 / 3 / 5 /
          8. Cougars cannot choose Home.
        </p>
      </PixelPanel>

      <PixelPanel className="mt-4" title="SIDES">
        <ul className="space-y-2 text-sm text-[var(--hg-muted)]">
          <li>
            Alpacas — survival, location weights, class abilities (King, Guardian, Farmer, Lucky,
            Runner, Common).
          </li>
          <li>Cougars — hunting; identical units; weight = 1; no special abilities.</li>
        </ul>
      </PixelPanel>

      <PixelPanel className="mt-4" title="MORE">
        <p className="text-sm text-[var(--hg-muted)]">
          <Link href="/docs/HANSOME_Alpacas_Player_Guide_Bilingual.pdf" className="text-[#f0c44a] underline">
            Player Guide (PDF)
          </Link>
          {" · "}
          <Link href={gameHref.home} className="text-[#f0c44a] underline">
            {t.nav.home}
          </Link>
        </p>
      </PixelPanel>
    </div>
  );
}
