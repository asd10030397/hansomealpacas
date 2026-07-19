"use client";

import type { CSSProperties, ReactNode } from "react";

export type SettlementResultRow = {
  tokenId: number;
  side?: string | null;
  source?: "mock" | "chain" | string;
  rewardLabel: string;
  locationName: string;
  outcome: string;
  ability?: string | null;
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
  const hasAbility = Boolean(row.ability && row.ability !== "—");

  return (
    <li
      className="hg-settle-card"
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
          <dt>Location</dt>
          <dd>{row.locationName}</dd>
        </div>
        <div className="hg-settle-card__row">
          <dt>Outcome</dt>
          <dd>{row.outcome}</dd>
        </div>
      </dl>
      {hasAbility ? (
        <div className="hg-settle-card__ability">
          <span className="hg-settle-card__ability-label">Ability</span>
          {row.ability}
        </div>
      ) : (
        <dl className="hg-settle-card__meta">
          <div className="hg-settle-card__row">
            <dt>Ability</dt>
            <dd>—</dd>
          </div>
        </dl>
      )}
    </li>
  );
}
