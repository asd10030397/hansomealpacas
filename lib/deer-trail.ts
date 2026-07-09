import type { DeerTrailItemCopy } from "@/content/i18n/types";
import { getProjectLinks } from "@/lib/links";

export type DeerTrailItem = DeerTrailItemCopy & {
  status: "done" | "upcoming";
};

export function isCommunityActive(): boolean {
  const { twitter, telegram } = getProjectLinks();
  return Boolean(twitter && telegram);
}

export function getDeerTrailItems(items: readonly DeerTrailItemCopy[]): DeerTrailItem[] {
  const communityActive = isCommunityActive();

  return items.map((item) => ({
    ...item,
    status:
      item.id === "website" || item.id === "deer-identity" || (item.id === "community" && communityActive)
        ? "done"
        : "upcoming",
  }));
}
