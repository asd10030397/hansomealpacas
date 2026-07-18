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

      <div className="mt-4 flex flex-wrap gap-2">
        <PixelButton
          size="sm"
          variant={side === "Alpaca" ? "green" : "slate"}
          onClick={() => {
            setSide("Alpaca");
            setSelected(null);
          }}
        >
          ALPACA VIEW
        </PixelButton>
        <PixelButton
          size="sm"
          variant={side === "Cougar" ? "danger" : "slate"}
          onClick={() => {
            setSide("Cougar");
            setSelected(null);
          }}
        >
          COUGAR VIEW
        </PixelButton>
        {selected !== null ? <PixelBadge tone="gold">Selected: {GAME_LOCATIONS[selected].name}</PixelBadge> : null}
      </div>

      <PixelPanel className="mt-4" title="WORLD MAP" eyebrow="PLACEHOLDER NAMES">
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
          <p className="mt-3 text-xs text-[#c44b3a]">Cougars cannot select Home.</p>
        ) : null}
      </PixelPanel>
    </div>
  );
}
