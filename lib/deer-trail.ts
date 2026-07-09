import type { DeerTrailItemCopy } from "@/content/i18n/types";

export const COMMUNITY_X_URL = "https://x.com/DeerloveRu";
export const COMMUNITY_X_HANDLE = "@DeerloveRu";

export type DeerTrailItem = DeerTrailItemCopy & {
  status: "done" | "upcoming";
};

export function getDeerTrailItems(items: readonly DeerTrailItemCopy[]): DeerTrailItem[] {
  return items.map((item) => ({
    ...item,
    status:
      item.id === "website" || item.id === "deer-identity" || item.id === "community"
        ? "done"
        : "upcoming",
  }));
}
