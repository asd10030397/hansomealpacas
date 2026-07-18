import Image from "next/image";
import type { MockNft } from "@/types/game";
import { GAME_LOCATIONS } from "@/data/game/locations";
import { PixelBadge, PixelCard } from "@/components/ui/pixel";

export function NFTCard({ nft }: { nft: MockNft }) {
  const loc = GAME_LOCATIONS.find((l) => l.id === nft.selectedLocationId);
  return (
    <PixelCard>
      <div className="relative mb-2 aspect-square overflow-hidden border-2 border-[#0d1018] bg-[#0d1018]">
        <Image
          src={nft.image}
          alt={`Genesis #${nft.tokenId}`}
          fill
          className="object-contain p-2"
          unoptimized
        />
      </div>
      <p className="pixel-title text-[0.65rem]">#{String(nft.tokenId).padStart(3, "0")}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <PixelBadge tone={nft.side === "Cougar" ? "danger" : "green"}>{nft.side}</PixelBadge>
        <PixelBadge tone="slate">
          {nft.side === "Cougar" ? "W=1" : nft.gameplayClass}
        </PixelBadge>
        <PixelBadge tone={nft.revealed ? "blue" : "gold"}>
          {nft.revealed ? "REVEALED" : "UNREVEALED"}
        </PixelBadge>
      </div>
      <dl className="mt-3 space-y-1 text-xs text-[var(--hg-muted)]">
        <div className="flex justify-between gap-2">
          <dt>Game</dt>
          <dd className="text-[#f3ebe0]">{nft.gameStatus}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Location</dt>
          <dd className="text-[#f3ebe0]">{loc?.name ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Claimable</dt>
          <dd className="text-[#f0c44a]">{nft.claimableHansome} (mock)</dd>
        </div>
      </dl>
      {nft.side === "Cougar" ? (
        <p className="mt-2 text-[0.65rem] text-[var(--hg-muted)]">
          Identical unit — no rarity / no special abilities.
        </p>
      ) : null}
    </PixelCard>
  );
}
