"use client";

import { useMemo, useState } from "react";
import { NFTCard } from "@/components/nft/NFTCard";
import { PixelButton } from "@/components/ui/pixel";
import { MOCK_NFTS } from "@/data/game/mock";
import { useGameI18n } from "@/hooks/game/useGameI18n";

type Filter = "all" | "alpacas" | "cougars" | "revealed" | "unrevealed";

export default function MyNftsPage() {
  const { t } = useGameI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const items = useMemo(() => {
    return MOCK_NFTS.filter((n) => {
      if (filter === "alpacas") return n.side === "Alpaca";
      if (filter === "cougars") return n.side === "Cougar";
      if (filter === "revealed") return n.revealed;
      if (filter === "unrevealed") return !n.revealed;
      return true;
    });
  }, [filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "ALL" },
    { id: "alpacas", label: "ALPACAS" },
    { id: "cougars", label: "COUGARS" },
    { id: "revealed", label: "REVEALED" },
    { id: "unrevealed", label: "UNREVEALED" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-3 py-6">
      <p className="mock-chip mb-3">{t.common.demoBanner}</p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">{t.myNfts.heading}</h1>
      <p className="mt-2 text-sm text-[var(--hg-muted)]">{t.myNfts.blurb}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <PixelButton
            key={f.id}
            size="sm"
            variant={filter === f.id ? "gold" : "slate"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </PixelButton>
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((nft) => (
          <NFTCard key={nft.tokenId} nft={nft} />
        ))}
      </div>
    </div>
  );
}
