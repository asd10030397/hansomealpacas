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
  { key: "treasury", percent: 90, color: "#ffffff" },
  { key: "liquidity", percent: 5, color: "#7dd3fc" },
  { key: "founder", percent: 5, color: "#525252" },
] as const;

export const ROADMAP_STATUS_STYLES: Record<string, string> = {
  completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  inProgress: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  future: "border-white/15 bg-white/5 text-white/50",
};

export const REVENUE_STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  planned: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  exploratory: "border-white/15 bg-white/5 text-white/50",
};

export const LIFECYCLE_LOOP_COUNT = 6;

export const PDF_DOWNLOAD_PATHS: Record<"en" | "zh", string> = {
  en: "/docs/litepaper-en.pdf",
  zh: "/docs/litepaper-zh.pdf",
};
