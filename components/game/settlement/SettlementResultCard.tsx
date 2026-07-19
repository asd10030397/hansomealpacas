"use client";

import type { CSSProperties, ReactNode } from "react";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { isMissedRevealOutcome } from "@/lib/game/missedReveal";

export type SettlementResultRow = {
  tokenId: number;
  side?: string | null;
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
}: {
  row: SettlementResultRow;
  index: number;
  overlays?: ReactNode;
}) {
  const { t } = useGameI18n();
  const missed =
    row.missedReveal === true || isMissedRevealOutcome(row.outcome);
  const hasAbility = !missed && Boolean(row.ability && row.ability !== "—");

  return (
    <li
      className={`hg-settle-card${missed ? " hg-settle-card--missed" : ""}`}
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` } as CSSProperties}
    >
      {overlays}
      <div className="hg-settle-card__head">
        <span className="hg-settle-card__id">
          #{row.tokenId}
          {row.side ? ` · ${row.side}` : ""}
          {row.source ? (
            <span className="hg-settle-card__source">
              {row.source === "mock" ? "MOCK" : "CHAIN"}
            </span>
          ) : null}
        </span>
        <span className="hg-settle-card__reward">{row.rewardLabel}</span>
      </div>
      <dl className="hg-settle-card__meta">
        <div className="hg-settle-card__row">
          <dt>{t.settlement.locationLabel}</dt>
          <dd>{missed ? "—" : row.locationName}</dd>
        </div>
        <div className="hg-settle-card__row">
          <dt>{t.settlement.outcomeLabel}</dt>
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
              row.outcome
            )}
          </dd>
        </div>
      </dl>
      {hasAbility ? (
        <div className="hg-settle-card__ability">
          <span className="hg-settle-card__ability-label">
            {t.settlement.abilityLabel}
          </span>
          {row.ability}
        </div>
      ) : (
        <dl className="hg-settle-card__meta">
          <div className="hg-settle-card__row">
            <dt>{t.settlement.abilityLabel}</dt>
            <dd>—</dd>
          </div>
        </dl>
      )}
    </li>
  );
}
