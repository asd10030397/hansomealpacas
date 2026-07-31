/**
 * Manual verify workflow helpers (MVP — no LLM).
 * Project-submitted → pending → HANSOME ops verify before public Explore labels.
 */

import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import {
  validateSubtags,
  validateTags,
} from "@/lib/hansome-taxonomy/categories";
import { assertMemeStoryTextAcceptable } from "@/lib/hansome-taxonomy/meme-story";
import {
  getTaxonomyRecord,
  upsertTaxonomyRecord,
} from "@/lib/hansome-taxonomy/store";
import type {
  SubmitCategoryRequestInput,
  SubmitMemeStoryInput,
  TokenTaxonomyRecord,
} from "@/lib/hansome-taxonomy/types";
import { getAddress, isAddress } from "viem";

function requireAddress(raw: string): string {
  if (!isAddress(raw)) throw new Error(`Invalid token address: ${raw}`);
  return getAddress(raw);
}

function baseRecord(
  tokenAddress: string,
  chainId: number,
): TokenTaxonomyRecord {
  const existing = getTaxonomyRecord(tokenAddress, chainId);
  if (existing) return { ...existing };
  const now = new Date().toISOString();
  return {
    tokenAddress,
    chainId,
    tags: ["other_unclassified"],
    subtags: [],
    source: "project",
    verifiedBy: null,
    verifiedAt: null,
    categoryVerified: false,
    memeStoryText: null,
    memeStoryTier: "unknown",
    memeStorySources: [],
    memeStorySource: null,
    memeStoryVerifiedBy: null,
    memeStoryVerifiedAt: null,
    updatedAt: now,
    notes: null,
  };
}

/** Project (or ops) submits category request — not public until verified. */
export function submitCategoryRequest(
  input: SubmitCategoryRequestInput,
): TokenTaxonomyRecord {
  const tokenAddress = requireAddress(input.tokenAddress);
  const chainId = input.chainId ?? SCAN_CHAIN_ID;
  const tags = validateTags(input.tags);
  const subtags = validateSubtags(input.subtags ?? []);
  if (subtags.length > 0 && !tags.includes("animal_memes")) {
    throw new Error("Animal subtags require Animal Memes category");
  }
  const now = new Date().toISOString();
  const next = baseRecord(tokenAddress, chainId);
  next.tags = tags;
  next.subtags = subtags;
  next.source = "project";
  next.categoryVerified = false;
  next.verifiedBy = null;
  next.verifiedAt = null;
  next.updatedAt = now;
  next.notes = input.notes ?? next.notes ?? null;
  if (input.submittedBy) {
    next.notes = [next.notes, `submittedBy=${input.submittedBy}`]
      .filter(Boolean)
      .join("; ");
  }
  return upsertTaxonomyRecord(next);
}

/** HANSOME manual verify — required before public Explore category label. */
export function verifyCategory(
  tokenAddress: string,
  verifiedBy: string,
  chainId: number = SCAN_CHAIN_ID,
): TokenTaxonomyRecord {
  const address = requireAddress(tokenAddress);
  if (!verifiedBy.trim()) throw new Error("verifiedBy is required");
  const next = baseRecord(address, chainId);
  if (next.tags.length === 0) {
    throw new Error("Cannot verify category with empty tags");
  }
  next.categoryVerified = true;
  next.verifiedBy = verifiedBy.trim();
  next.verifiedAt = new Date().toISOString();
  next.source =
    next.source === "project" ? "project" : "hansome_manual";
  next.updatedAt = next.verifiedAt;
  return upsertTaxonomyRecord(next);
}

export function submitMemeStory(
  input: SubmitMemeStoryInput,
): TokenTaxonomyRecord {
  const tokenAddress = requireAddress(input.tokenAddress);
  const chainId = input.chainId ?? SCAN_CHAIN_ID;
  const text = assertMemeStoryTextAcceptable(input.text);
  const now = new Date().toISOString();
  const next = baseRecord(tokenAddress, chainId);
  next.memeStoryText = text;
  next.memeStoryTier = "community_public";
  next.memeStorySources = input.sources ?? [];
  next.memeStorySource = input.sourceKind ?? "project";
  next.memeStoryVerifiedBy = null;
  next.memeStoryVerifiedAt = null;
  next.updatedAt = now;
  return upsertTaxonomyRecord(next);
}

/** Manual review → Verified Project Description (no LLM). */
export function verifyMemeStory(
  tokenAddress: string,
  verifiedBy: string,
  chainId: number = SCAN_CHAIN_ID,
): TokenTaxonomyRecord {
  const address = requireAddress(tokenAddress);
  if (!verifiedBy.trim()) throw new Error("verifiedBy is required");
  const next = baseRecord(address, chainId);
  if (!next.memeStoryText?.trim()) {
    throw new Error("Cannot verify Meme Story without text");
  }
  next.memeStoryTier = "verified";
  next.memeStoryVerifiedBy = verifiedBy.trim();
  next.memeStoryVerifiedAt = new Date().toISOString();
  next.memeStorySource = next.memeStorySource ?? "hansome_manual";
  next.updatedAt = next.memeStoryVerifiedAt;
  return upsertTaxonomyRecord(next);
}

export function setMemeStoryUnknown(
  tokenAddress: string,
  chainId: number = SCAN_CHAIN_ID,
): TokenTaxonomyRecord {
  const address = requireAddress(tokenAddress);
  const next = baseRecord(address, chainId);
  next.memeStoryText = null;
  next.memeStoryTier = "unknown";
  next.memeStorySources = [];
  next.memeStorySource = null;
  next.memeStoryVerifiedBy = null;
  next.memeStoryVerifiedAt = null;
  next.updatedAt = new Date().toISOString();
  return upsertTaxonomyRecord(next);
}
