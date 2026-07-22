"use client";

import Image from "next/image";
import {
  NFT_IMAGE_FALLBACK_ALPACA,
  shortAddress,
  speciesClassLabel,
} from "@/lib/game/nftDisplay";

type ForumIdentityBadgeProps = {
  tokenId: number;
  authorAddress: string;
  /** Resolved art — owned inventory or public metadata when reveal policy allows. */
  image?: string | null;
  side?: "Alpaca" | "Cougar" | "Unknown" | null;
  gameplayClass?: string | null;
  compact?: boolean;
};

export function ForumIdentityBadge({
  tokenId,
  authorAddress,
  image,
  side,
  gameplayClass,
  compact,
}: ForumIdentityBadgeProps) {
  const src =
    image && image.length > 0 ? image : NFT_IMAGE_FALLBACK_ALPACA;
  const label = speciesClassLabel(side ?? null, gameplayClass as never);

  return (
    <div
      className={`flex items-center gap-2 ${compact ? "" : "gap-3"}`}
      data-forum-identity="true"
    >
      <div
        className={`relative shrink-0 overflow-hidden rounded border border-[#f0c44a]/30 bg-[#1a1520]/80 ${
          compact ? "h-9 w-9" : "h-11 w-11"
        }`}
      >
        <Image
          src={src}
          alt=""
          fill
          sizes={compact ? "36px" : "44px"}
          className="object-cover object-top"
          unoptimized={src.startsWith("http")}
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#f0c44a]">
          #{tokenId}
          {!compact ? ` · ${label}` : ""}
        </p>
        {authorAddress ? (
          <p className="truncate text-xs text-[var(--hg-muted)]">
            {shortAddress(authorAddress)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
