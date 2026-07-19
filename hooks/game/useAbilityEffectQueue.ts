"use client";

/**
 * @deprecated Prefer useSettlementPresentationQueue (result SFX + ability, ordered).
 * Thin adapter kept for any residual imports.
 */
import {
  useSettlementPresentationQueue,
  type SettlementPresentationRow,
} from "@/hooks/game/useSettlementPresentationQueue";

export type AbilityEffectRow = {
  tokenId: number;
  ability: string | null;
  outcome?: string;
};

export function useAbilityEffectQueue(
  day: number,
  rows: AbilityEffectRow[],
  enabled: boolean,
) {
  const presentationRows: SettlementPresentationRow[] = rows.map((r) => ({
    tokenId: r.tokenId,
    outcome: r.outcome ?? "",
    ability: r.ability,
  }));
  const { currentAbility, advance } = useSettlementPresentationQueue(
    day,
    presentationRows,
    enabled,
  );
  return { current: currentAbility, advance };
}
