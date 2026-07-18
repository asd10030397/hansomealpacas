"use client";

import { useState } from "react";
import { LocationCard } from "@/components/game/LocationCard";
import { PixelBadge, PixelButton, PixelPanel } from "@/components/ui/pixel";
import { GAME_LOCATIONS } from "@/data/game/locations";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import type { LocationId, NftSide } from "@/types/game";

export default function ExplorePage() {
  const { t } = useGameI18n();
  const [side, setSide] = useState<NftSide>("Alpaca");
  const [selected, setSelected] = useState<LocationId | null>(null);

  return (
    <div className="mx-auto max-w-5xl px-3 py-6">
      <p className="mock-chip mb-3">{t.common.demoBanner}</p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">{t.explore.heading}</h1>
      <p className="mt-2 text-sm text-[var(--hg-muted)]">{t.explore.blurb}</p>

      <PixelPanel className="mt-4" title={t.explore.flowTitle}>
        <ol className="grid gap-2 sm:grid-cols-5">
          {t.explore.flowSteps.map(([step, hint], i) => (
            <li
              key={step}
              className="border-2 border-[#0d1018] bg-[#121826] px-2 py-2 text-center"
            >
              <p className="pixel-title text-[0.5rem] text-[#f0c44a]">
                {i + 1}. {step}
              </p>
              <p className="mt-1 text-[0.65rem] text-[var(--hg-muted)]">{hint}</p>
            </li>
          ))}
        </ol>
      </PixelPanel>

      <div className="mt-4 flex flex-wrap gap-2">
        <PixelButton
          size="sm"
          variant={side === "Alpaca" ? "green" : "slate"}
          onClick={() => {
            setSide("Alpaca");
            setSelected(null);
          }}
        >
          {t.explore.alpacaView}
        </PixelButton>
        <PixelButton
          size="sm"
          variant={side === "Cougar" ? "danger" : "slate"}
          onClick={() => {
            setSide("Cougar");
            setSelected(null);
          }}
        >
          {t.explore.cougarView}
        </PixelButton>
        {selected !== null ? (
          <PixelBadge tone="gold">
            {GAME_LOCATIONS[selected].name} · W{GAME_LOCATIONS[selected].weight}
          </PixelBadge>
        ) : null}
      </div>

      <PixelPanel className="mt-4" title={t.explore.mapTitle} eyebrow={t.explore.mapEyebrow}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_LOCATIONS.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              side={side}
              selected={selected === loc.id}
              onSelect={setSelected}
            />
          ))}
        </div>
        {side === "Cougar" ? (
          <p className="mt-3 text-xs text-[#c44b3a]">{t.explore.cougarHomeNote}</p>
        ) : null}
      </PixelPanel>
    </div>
  );
}
