/**
 * Language-independent structural/visual config for the /litepaper page.
 * All copy (headings, paragraphs, labels, FAQ, etc.) lives in
 * content/i18n/en.ts and content/i18n/zh.ts under the `litepaper` key —
 * this file only holds things that don't need translation: section order,
 * diagram numbers/colors, and status → color mappings.
 */

export const LITEPAPER_SECTION_ORDER: readonly string[] = [
  "founder-letter",
  "introduction",
  "vision",
  "philosophy",
  "tokenomics",
  "treasury",
  "liquidity",
  "revenue",
  "roadmap",
  "community",
  "long-term-vision",
  "faq",
  "changelog",
  "language",
] as const;

export type TokenomicsSliceKey = "treasury" | "liquidity" | "founder";

export const TOKENOMICS_SLICES: readonly { key: TokenomicsSliceKey; percent: number; color: string }[] = [
  { key: "treasury", percent: 90, color: "#f2b33d" },
  { key: "liquidity", percent: 5, color: "#6fbf57" },
  { key: "founder", percent: 5, color: "#ffe7a6" },
] as const;

export const ROADMAP_STATUS_STYLES: Record<string, string> = {
  completed: "border-grass/40 bg-grass/15 text-grass",
  inProgress: "border-gold/40 bg-gold/15 text-gold",
  future: "border-[var(--lp-text-faint)]/40 bg-white/[0.03] text-[var(--lp-text-faint)]",
};

export const REVENUE_STATUS_STYLES: Record<string, string> = {
  active: "border-grass/40 bg-grass/15 text-grass",
  planned: "border-gold/40 bg-gold/15 text-gold",
  exploratory: "border-[var(--lp-text-faint)]/40 bg-white/[0.03] text-[var(--lp-text-faint)]",
};

export const LIFECYCLE_LOOP_COUNT = 6;

export const PDF_DOWNLOAD_PATHS: Record<"en" | "zh", string> = {
  en: "/docs/litepaper-en.pdf",
  zh: "/docs/litepaper-zh.pdf",
};
