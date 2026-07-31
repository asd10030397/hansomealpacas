import type {
  AnimalSubtagDef,
  AnimalSubtagId,
  TaxonomyCategoryDef,
  TaxonomyCategoryId,
} from "@/lib/hansome-taxonomy/types";

/** Top-level categories — config-driven; add/rename without score engine changes. */
export const TAXONOMY_CATEGORIES: readonly TaxonomyCategoryDef[] = [
  { id: "animal_memes", label: "Animal Memes" },
  { id: "meme", label: "Meme" },
  { id: "ai_agent", label: "AI / AI Agent" },
  { id: "rwa", label: "RWA" },
  { id: "defi", label: "DeFi" },
  { id: "gaming", label: "Gaming" },
  { id: "nft", label: "NFT" },
  { id: "utility_infra", label: "Utility / Infrastructure" },
  { id: "social", label: "Social" },
  { id: "other_unclassified", label: "Other / Unclassified" },
] as const;

export const ANIMAL_SUBTAGS: readonly AnimalSubtagDef[] = [
  { id: "dog", label: "Dog" },
  { id: "cat", label: "Cat" },
  { id: "frog", label: "Frog" },
  { id: "alpaca", label: "Alpaca" },
  { id: "penguin", label: "Penguin" },
  { id: "other_animal", label: "Other Animal" },
] as const;

const CATEGORY_BY_ID = new Map(
  TAXONOMY_CATEGORIES.map((c) => [c.id, c] as const),
);
const SUBTAG_BY_ID = new Map(ANIMAL_SUBTAGS.map((s) => [s.id, s] as const));

export function isTaxonomyCategoryId(value: string): value is TaxonomyCategoryId {
  return CATEGORY_BY_ID.has(value as TaxonomyCategoryId);
}

export function isAnimalSubtagId(value: string): value is AnimalSubtagId {
  return SUBTAG_BY_ID.has(value as AnimalSubtagId);
}

export function categoryLabel(id: TaxonomyCategoryId): string {
  return CATEGORY_BY_ID.get(id)?.label ?? id;
}

export function subtagLabel(id: AnimalSubtagId): string {
  return SUBTAG_BY_ID.get(id)?.label ?? id;
}

export function validateTags(tags: string[]): TaxonomyCategoryId[] {
  const out: TaxonomyCategoryId[] = [];
  for (const t of tags) {
    if (!isTaxonomyCategoryId(t)) {
      throw new Error(`Unknown taxonomy category: ${t}`);
    }
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function validateSubtags(subtags: string[]): AnimalSubtagId[] {
  const out: AnimalSubtagId[] = [];
  for (const s of subtags) {
    if (!isAnimalSubtagId(s)) {
      throw new Error(`Unknown animal subtag: ${s}`);
    }
    if (!out.includes(s)) out.push(s);
  }
  return out;
}
