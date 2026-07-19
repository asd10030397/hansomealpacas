"use client";

import Image from "next/image";
import type { GameLocation, NftSide } from "@/types/game";
import { PixelBadge, PixelCard } from "@/components/ui/pixel";
import { WalletGateButton } from "./WalletGateButton";

export function LocationCard({
  location,
  side,
  selected,
  onSelect,
}: {
  location: GameLocation;
  side: NftSide;
  selected?: boolean;
  onSelect?: (id: GameLocation["id"]) => void;
}) {
  const allowed =
    side === "Cougar" ? location.cougarAllowed : location.alpacaAllowed;
  const riskTone =
    location.riskLabel === "None" || location.riskLabel === "Low"
      ? "green"
      : location.riskLabel === "Medium"
        ? "gold"
        : "danger";

  return (
    <PixelCard className={selected ? "ring-2 ring-[#f0c44a]" : ""}>
      <div className="relative mb-2 aspect-[4/3] overflow-hidden border-2 border-[#0d1018]">
        <Image
          src={location.thumbnail}
          alt={`${location.name} map`}
          width={640}
          height={480}
          className="h-full w-full object-cover [image-rendering:auto]"
          sizes="(max-width: 640px) 100vw, 280px"
          unoptimized
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d1018]/55 via-transparent to-[#0d1018]/15"
          aria-hidden
        />
      </div>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="pixel-title text-[0.65rem]">{location.name}</h3>
        <PixelBadge tone="slate">W {location.weight}</PixelBadge>
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        <PixelBadge tone={riskTone}>RISK {location.riskLabel}</PixelBadge>
        <PixelBadge tone="blue">PRESSURE {location.pressure} (demo)</PixelBadge>
      </div>
      {!allowed ? (
        <p className="text-xs text-[#c44b3a]">Not available for Cougars</p>
      ) : (
        <WalletGateButton
          feature={`Select ${location.name}`}
          size="sm"
          variant={selected ? "gold" : "green"}
          onReady={() => onSelect?.(location.id)}
        >
          {selected ? "SELECTED" : "SELECT"}
        </WalletGateButton>
      )}
    </PixelCard>
  );
}
