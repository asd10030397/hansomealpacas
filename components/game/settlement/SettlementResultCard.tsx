"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { isMissedRevealOutcome } from "@/lib/game/missedReveal";
import {
  formatBattleRewardLabel,
  formatBattleStatus,
  shortAddress,
  speciesClassLabel,
} from "@/lib/game/nftDisplay";
import type { GameplayClass, NftSide } from "@/types/game";

export type SettlementResultRow = {
  tokenId: number;
  side?: string | null;
  gameplayClass?: GameplayClass | null;
  image?: string | null;
  ownerAddress?: string | null;
  isOwn?: boolean;
  claimStatus?: string | null;
  source?: "mock" | "chain" | string;
  rewardLabel: string;
  locationName: string;
  outcome: string;
  ability?: string | null;
  missedReveal?: boolean;
};

export function SettlementResultCard({
  row,
  index,
  overlays,
  highlightOwn = false,
}: {
  row: SettlementResultRow;
  index: number;
  overlays?: ReactNode;
  highlightOwn?: boolean;
}) {
  const { t } = useGameI18n();
  const missed =
    row.missedReveal === true || isMissedRevealOutcome(row.outcome);
  const hasAbility = !missed && Boolean(row.ability && row.ability !== "—");
  const side = (row.side as NftSide | null) ?? null;
  const title = speciesClassLabel(side, row.gameplayClass ?? null);
  const status = missed
    ? t.settlement.missedRevealTitle
    : formatBattleStatus(row.outcome);
  const reward = formatBattleRewardLabel({
    rewardLabel: row.rewardLabel,
    missedReveal: missed,
  });
  const image =
    row.image && row.image.length > 0
      ? row.image
      : side === "Cougar"
        ? "/pixel/cougar/mint/image/cougar.png"
        : "/assets/characters/alpaca-hero-ranch.png";

  return (
    <li
      className={`hg-settle-card${missed ? " hg-settle-card--missed" : ""}${
        highlightOwn || row.isOwn ? " hg-settle-card--own" : ""
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` } as CSSProperties}
      data-token-id={row.tokenId}
    >
      {overlays}
      <div className="hg-settle-card__media">
        <div className="hg-settle-card__art">
          <Image
            src={image}
            alt={`Genesis #${row.tokenId} ${title}`}
            fill
            className="object-contain p-1.5"
            sizes="(max-width: 640px) 40vw, 140px"
            unoptimized
          />
        </div>
        <div className="hg-settle-card__identity">
          <p className="hg-settle-card__id">
            #{row.tokenId} {title}
          </p>
          {row.isOwn ? (
            <span className="hg-settle-card__yours">{t.result.yourNftBadge}</span>
          ) : null}
          <p className="hg-settle-card__wallet">
            {t.result.ownerLabel}: {shortAddress(row.ownerAddress)}
          </p>
          {row.source ? (
            <span className="hg-settle-card__source">
              {row.source === "mock" ? "MOCK" : "CHAIN"}
            </span>
          ) : null}
        </div>
      </div>

      <dl className="hg-settle-card__meta">
        <div className="hg-settle-card__row">
          <dt>{t.settlement.locationLabel}</dt>
          <dd>{missed ? "—" : row.locationName}</dd>
        </div>
        <div className="hg-settle-card__row">
          <dt>{t.result.statusLabel}</dt>
          <dd>
            {missed ? (
              <div className="hg-settle-card__missed" role="status">
                <p className="hg-settle-card__missed-title">
                  {t.settlement.missedRevealTitle}
                </p>
                <p>{t.settlement.missedRevealZero}</p>
                <p>{t.settlement.missedRevealNext}</p>
              </div>
            ) : (
              status
            )}
          </dd>
        </div>
        <div className="hg-settle-card__row">
          <dt>{t.settlement.abilityLabel}</dt>
          <dd>{hasAbility ? row.ability : "—"}</dd>
        </div>
        {row.claimStatus ? (
          <div className="hg-settle-card__row">
            <dt>{t.result.claimStatusLabel}</dt>
            <dd>{row.claimStatus}</dd>
          </div>
        ) : null}
      </dl>

      {hasAbility ? (
        <div className="hg-settle-card__ability">
          <span className="hg-settle-card__ability-label">
            {t.settlement.abilityLabel}
          </span>
          {row.ability}
        </div>
      ) : null}

      <div className="hg-settle-card__reward-block">
        <span className="hg-settle-card__reward-label">{t.result.rewardLabel}</span>
        <span className="hg-settle-card__reward">{reward}</span>
      </div>
    </li>
  );
}
