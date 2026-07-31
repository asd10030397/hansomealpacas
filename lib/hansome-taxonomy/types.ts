/**
 * Category / Tags + Meme Story (Context) metadata.
 * Never feeds Structural Score, Overall, Activity, Trending, or Confidence.
 *
 * Specs: docs/HANSOME_TAXONOMY_AND_EXPLORE.md, docs/HANSOME_MEME_STORY_SPEC.md
 */

export type TaxonomyCategoryId =
  | "animal_memes"
  | "meme"
  | "ai_agent"
  | "rwa"
  | "defi"
  | "gaming"
  | "nft"
  | "utility_infra"
  | "social"
  | "other_unclassified";

export type AnimalSubtagId =
  | "dog"
  | "cat"
  | "frog"
  | "alpaca"
  | "penguin"
  | "other_animal";

export type TaxonomySource = "project" | "hansome_manual";

export type MemeStoryTier = "verified" | "community_public" | "unknown";

export type MemeStorySourceKind = "project" | "hansome_manual" | "public_doc";

export type TaxonomyCategoryDef = {
  id: TaxonomyCategoryId;
  label: string;
};

export type AnimalSubtagDef = {
  id: AnimalSubtagId;
  label: string;
};

/** Persisted row (config/JSON store) — Week 2–3 metadata window. */
export type TokenTaxonomyRecord = {
  tokenAddress: string;
  chainId: number;
  /** Multi-tag OK. Unverified public Explore → other/hidden. */
  tags: TaxonomyCategoryId[];
  subtags: AnimalSubtagId[];
  /** Category/tag assignment provenance. */
  source: TaxonomySource;
  verifiedBy: string | null;
  verifiedAt: string | null;
  /** Category labels are public only after HANSOME manual verify. */
  categoryVerified: boolean;
  memeStoryText: string | null;
  memeStoryTier: MemeStoryTier;
  memeStorySources: string[];
  memeStorySource: MemeStorySourceKind | null;
  memeStoryVerifiedBy: string | null;
  memeStoryVerifiedAt: string | null;
  updatedAt: string;
  notes?: string | null;
};

/**
 * Scan-facing Context block. Presentation / discovery only —
 * scanning engine must ignore for Score axes.
 */
export type TokenContextMetadata = {
  category: {
    tags: TaxonomyCategoryId[];
    tagLabels: string[];
    subtags: AnimalSubtagId[];
    subtagLabels: string[];
    verified: boolean;
    source: TaxonomySource | null;
    /** When unverified or missing: treat as Other / Unclassified for public filters. */
    publicLabel: string;
  };
  memeStory: {
    text: string | null;
    tier: MemeStoryTier;
    tierLabel: string;
    sources: string[];
    /** Exact Unknown copy when tier = unknown. */
    displayText: string;
  };
  affectsScore: false;
  note: string;
};

export type SubmitCategoryRequestInput = {
  tokenAddress: string;
  chainId: number;
  tags: TaxonomyCategoryId[];
  subtags?: AnimalSubtagId[];
  submittedBy?: string;
  notes?: string;
};

export type SubmitMemeStoryInput = {
  tokenAddress: string;
  chainId: number;
  text: string;
  sources?: string[];
  sourceKind?: MemeStorySourceKind;
  submittedBy?: string;
};
