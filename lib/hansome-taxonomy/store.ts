import { getAddress, isAddress } from "viem";
import tokenMetadataJson from "@/content/taxonomy/token-metadata.json";
import {
  categoryLabel,
  subtagLabel,
  validateSubtags,
  validateTags,
} from "@/lib/hansome-taxonomy/categories";
import {
  MEME_STORY_UNKNOWN_COPY,
  memeStoryTierLabel,
  resolveMemeStoryDisplayText,
} from "@/lib/hansome-taxonomy/meme-story";
import type {
  AnimalSubtagId,
  TaxonomyCategoryId,
  TaxonomySource,
  TokenContextMetadata,
  TokenTaxonomyRecord,
} from "@/lib/hansome-taxonomy/types";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";

type StoreFile = {
  version: string;
  note?: string;
  records: TokenTaxonomyRecord[];
};

const CONTEXT_NOTE =
  "Context / taxonomy only — does not affect HANSOME Score, Activity, Trending, or Data Confidence.";

/** In-memory overlay for verify workflow tests / future ops writes (does not mutate JSON on disk). */
const runtimeOverlay = new Map<string, TokenTaxonomyRecord>();

function recordKey(address: string, chainId: number): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function normalizeAddress(raw: string): string {
  if (!isAddress(raw)) {
    throw new Error(`Invalid token address: ${raw}`);
  }
  return getAddress(raw);
}

function loadSeedRecords(): TokenTaxonomyRecord[] {
  const file = tokenMetadataJson as StoreFile;
  return Array.isArray(file.records) ? file.records : [];
}

export function clearTaxonomyRuntimeOverlay(): void {
  runtimeOverlay.clear();
}

export function listTaxonomyRecords(): TokenTaxonomyRecord[] {
  const byKey = new Map<string, TokenTaxonomyRecord>();
  for (const r of loadSeedRecords()) {
    byKey.set(recordKey(r.tokenAddress, r.chainId), {
      ...r,
      tokenAddress: normalizeAddress(r.tokenAddress),
    });
  }
  for (const [k, r] of runtimeOverlay) {
    byKey.set(k, r);
  }
  return [...byKey.values()];
}

export function getTaxonomyRecord(
  tokenAddress: string,
  chainId: number = SCAN_CHAIN_ID,
): TokenTaxonomyRecord | null {
  const address = normalizeAddress(tokenAddress);
  const key = recordKey(address, chainId);
  if (runtimeOverlay.has(key)) {
    return runtimeOverlay.get(key) ?? null;
  }
  const found = loadSeedRecords().find(
    (r) =>
      r.chainId === chainId &&
      r.tokenAddress.toLowerCase() === address.toLowerCase(),
  );
  return found
    ? { ...found, tokenAddress: normalizeAddress(found.tokenAddress) }
    : null;
}

export function upsertTaxonomyRecord(record: TokenTaxonomyRecord): TokenTaxonomyRecord {
  const address = normalizeAddress(record.tokenAddress);
  const tags = validateTags(record.tags);
  const subtags = validateSubtags(record.subtags);
  const next: TokenTaxonomyRecord = {
    ...record,
    tokenAddress: address,
    tags,
    subtags,
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
  runtimeOverlay.set(recordKey(address, next.chainId), next);
  return next;
}

function emptyContext(): TokenContextMetadata {
  return {
    category: {
      tags: ["other_unclassified"],
      tagLabels: [categoryLabel("other_unclassified")],
      subtags: [],
      subtagLabels: [],
      verified: false,
      source: null,
      publicLabel: categoryLabel("other_unclassified"),
    },
    memeStory: {
      text: null,
      tier: "unknown",
      tierLabel: memeStoryTierLabel("unknown"),
      sources: [],
      displayText: MEME_STORY_UNKNOWN_COPY,
    },
    affectsScore: false,
    note: CONTEXT_NOTE,
  };
}

/**
 * Build Scan-facing context. Unverified category → Other / Unclassified for public label.
 * Never invents Meme Story lore.
 */
export function getTokenContextMetadata(
  tokenAddress: string,
  chainId: number = SCAN_CHAIN_ID,
): TokenContextMetadata {
  const record = getTaxonomyRecord(tokenAddress, chainId);
  if (!record) return emptyContext();

  const verified = record.categoryVerified === true;
  const tags: TaxonomyCategoryId[] = verified
    ? record.tags.length > 0
      ? record.tags
      : ["other_unclassified"]
    : ["other_unclassified"];
  const subtags: AnimalSubtagId[] =
    verified && tags.includes("animal_memes") ? record.subtags : [];

  const publicLabel = verified
    ? tags.map(categoryLabel).join(" · ")
    : categoryLabel("other_unclassified");

  const tier = record.memeStoryTier ?? "unknown";
  const text = record.memeStoryText;

  return {
    category: {
      tags,
      tagLabels: tags.map(categoryLabel),
      subtags,
      subtagLabels: subtags.map(subtagLabel),
      verified,
      source: (record.source as TaxonomySource) ?? null,
      publicLabel,
    },
    memeStory: {
      text: tier === "unknown" ? null : text,
      tier,
      tierLabel: memeStoryTierLabel(tier),
      sources: record.memeStorySources ?? [],
      displayText: resolveMemeStoryDisplayText(tier, text),
    },
    affectsScore: false,
    note: CONTEXT_NOTE,
  };
}
