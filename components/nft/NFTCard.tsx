import Image from "next/image";
import type { MockNft } from "@/types/game";
import { GAME_LOCATIONS } from "@/data/game/locations";
import { PixelBadge, PixelCard } from "@/components/ui/pixel";
import { abilityLabelFor } from "@/lib/game/genesisIdentity";

type CardNft = MockNft & {
  ability?: string;
  trait?: string;
  claimableWei?: bigint;
};

export function NFTCard({ nft, live = false }: { nft: CardNft; live?: boolean }) {
  const loc = GAME_LOCATIONS.find((l) => l.id === nft.selectedLocationId);
  const ability = nft.ability ?? abilityLabelFor(nft.side, nft.gameplayClass);
  const trait = nft.trait ?? (nft.side === "Cougar" ? "Cougar" : nft.gameplayClass);
  const claimable =
    nft.claimableWei != null && nft.claimableWei > 0n
      ? Number(nft.claimableHansome).toLocaleString(undefined, { maximumFractionDigits: 4 })
      : nft.claimableHansome > 0
        ? String(nft.claimableHansome)
        : "0";
  const claimableToday = nft.claimableWei != null ? nft.claimableWei > 0n : nft.claimableHansome > 0;

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
        <PixelBadge tone={nft.side === "Cougar" ? "danger" : "green"}>
          {nft.side === "Unknown" ? "ROLE ?" : nft.side}
        </PixelBadge>
        <PixelBadge tone="slate">{trait}</PixelBadge>
        <PixelBadge tone={nft.revealed ? "blue" : "gold"}>
          {nft.revealed ? "REVEALED" : "UNREVEALED"}
        </PixelBadge>
      </div>
      <dl className="mt-3 space-y-1 text-xs text-[var(--hg-muted)]">
        <div className="flex justify-between gap-2">
          <dt>Ability</dt>
          <dd className="text-[#f3ebe0]">{ability}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Game</dt>
          <dd className="text-[#f3ebe0]">{nft.gameStatus}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Location</dt>
          <dd className="text-[#f3ebe0]">{loc?.name ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Claimable today</dt>
          <dd className={claimableToday ? "text-[#f0c44a]" : "text-[#f3ebe0]"}>
            {live
              ? claimableToday
                ? `${claimable} tHANSOME`
                : "No"
              : `${claimable}`}
          </dd>
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
