import { describe, expect, it, beforeEach } from "vitest";
import { HANSOME_TOKEN, SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import {
  ANIMAL_SUBTAGS,
  MEME_STORY_UNKNOWN_COPY,
  TAXONOMY_CATEGORIES,
  clearTaxonomyRuntimeOverlay,
  getTaxonomyRecord,
  getTokenContextMetadata,
  submitCategoryRequest,
  submitMemeStory,
  verifyCategory,
  verifyMemeStory,
  setMemeStoryUnknown,
} from "@/lib/hansome-taxonomy";

describe("taxonomy definitions", () => {
  it("exposes config-driven top-level categories and animal subtags", () => {
    expect(TAXONOMY_CATEGORIES.map((c) => c.id)).toContain("animal_memes");
    expect(TAXONOMY_CATEGORIES.map((c) => c.label)).toContain(
      "Other / Unclassified",
    );
    expect(ANIMAL_SUBTAGS.map((s) => s.id)).toContain("alpaca");
  });
});

describe("HANSOME seed metadata", () => {
  beforeEach(() => {
    clearTaxonomyRuntimeOverlay();
  });

  it("loads verified Animal Memes + Alpaca + Verified Project Description", () => {
    const record = getTaxonomyRecord(HANSOME_TOKEN, SCAN_CHAIN_ID);
    expect(record).not.toBeNull();
    expect(record!.categoryVerified).toBe(true);
    expect(record!.tags).toEqual(
      expect.arrayContaining(["animal_memes", "meme"]),
    );
    expect(record!.subtags).toContain("alpaca");
    expect(record!.memeStoryTier).toBe("verified");
    expect(record!.memeStoryText).toMatch(/HANSOME ALPACAS/i);

    const ctx = getTokenContextMetadata(HANSOME_TOKEN, SCAN_CHAIN_ID);
    expect(ctx.affectsScore).toBe(false);
    expect(ctx.category.verified).toBe(true);
    expect(ctx.category.publicLabel).toContain("Animal Memes");
    expect(ctx.memeStory.tierLabel).toBe("Verified Project Description");
    expect(ctx.memeStory.displayText).toMatch(/too handsome/i);
  });

  it("unknown token → Other / Unclassified + Unknown story copy", () => {
    const ctx = getTokenContextMetadata(
      "0x0000000000000000000000000000000000000001",
      SCAN_CHAIN_ID,
    );
    expect(ctx.category.publicLabel).toBe("Other / Unclassified");
    expect(ctx.category.verified).toBe(false);
    expect(ctx.memeStory.tier).toBe("unknown");
    expect(ctx.memeStory.displayText).toBe(MEME_STORY_UNKNOWN_COPY);
  });
});

describe("manual verify workflow", () => {
  beforeEach(() => {
    clearTaxonomyRuntimeOverlay();
  });

  it("project submit stays unverified until ops verify", () => {
    const token = "0x1111111111111111111111111111111111111111";
    submitCategoryRequest({
      tokenAddress: token,
      chainId: SCAN_CHAIN_ID,
      tags: ["defi"],
      submittedBy: "project_ops",
    });
    const pending = getTokenContextMetadata(token, SCAN_CHAIN_ID);
    expect(pending.category.verified).toBe(false);
    expect(pending.category.publicLabel).toBe("Other / Unclassified");

    verifyCategory(token, "hansome_ops", SCAN_CHAIN_ID);
    const live = getTokenContextMetadata(token, SCAN_CHAIN_ID);
    expect(live.category.verified).toBe(true);
    expect(live.category.publicLabel).toBe("DeFi");
  });

  it("meme story verify requires text; unknown uses exact copy", () => {
    const token = "0x2222222222222222222222222222222222222222";
    expect(() => verifyMemeStory(token, "hansome_ops")).toThrow(/without text/i);

    submitMemeStory({
      tokenAddress: token,
      chainId: SCAN_CHAIN_ID,
      text: "A short public background about a meme on Robinhood Chain.",
      sources: ["https://example.com"],
    });
    const community = getTokenContextMetadata(token, SCAN_CHAIN_ID);
    expect(community.memeStory.tier).toBe("community_public");

    verifyMemeStory(token, "hansome_ops", SCAN_CHAIN_ID);
    const verified = getTokenContextMetadata(token, SCAN_CHAIN_ID);
    expect(verified.memeStory.tier).toBe("verified");
    expect(verified.memeStory.tierLabel).toBe("Verified Project Description");

    setMemeStoryUnknown(token, SCAN_CHAIN_ID);
    const unknown = getTokenContextMetadata(token, SCAN_CHAIN_ID);
    expect(unknown.memeStory.displayText).toBe(MEME_STORY_UNKNOWN_COPY);
  });

  it("rejects animal subtags without Animal Memes", () => {
    expect(() =>
      submitCategoryRequest({
        tokenAddress: "0x3333333333333333333333333333333333333333",
        chainId: SCAN_CHAIN_ID,
        tags: ["meme"],
        subtags: ["alpaca"],
      }),
    ).toThrow(/Animal Memes/i);
  });
});
