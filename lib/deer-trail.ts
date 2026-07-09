import { DEER_TRAIL, type DeerTrailItem } from "@/content/deer-trail";
import { getProjectLinks } from "@/lib/links";

export function isCommunityActive(): boolean {
  const { twitter, telegram } = getProjectLinks();
  return Boolean(twitter && telegram);
}

export function getDeerTrailItems(): DeerTrailItem[] {
  const communityActive = isCommunityActive();

  return DEER_TRAIL.items.map((item) =>
    item.label === "Community" && communityActive
      ? { ...item, status: "done" }
      : { ...item },
  );
}
