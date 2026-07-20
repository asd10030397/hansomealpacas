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
  "gameplay-overview",
  "gamefi-economic-model",
  "documents",
  "tokenomics",
  "treasury",
  "liquidity",
  "revenue",
  "roadmap",
  "community",
  "sustainable-ecosystem",
  "long-term-vision",
  "faq",
  "changelog",
  "language",
] as const;

/** Pixel art for Gameplay Overview (1:1, do not crop). */
export const GAMEPLAY_OVERVIEW_IMAGE = "/assets/litepaper/gameplay-overview.png";

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

/** Standalone GameFi economic model PDFs (EN / ZH) — served from `public/docs/`. */
export const ECONOMIC_MODEL_PDF_PATHS: Record<"en" | "zh", string> = {
  en: "/docs/HANSOME_GAME_ECONOMIC_MODEL_EN.pdf",
  zh: "/docs/HANSOME_GAME_ECONOMIC_MODEL_ZH.pdf",
};

/** Markdown companions for the economic model (also under `public/docs/`). */
export const ECONOMIC_MODEL_MD_PATHS: Record<"en" | "zh", string> = {
  en: "/docs/HANSOME_GAME_ECONOMIC_MODEL_EN.md",
  zh: "/docs/HANSOME_GAME_ECONOMIC_MODEL_ZH.md",
};

/** Litepaper “Documents” library — static assets under /docs/. */
export const LITEPAPER_DOC_LIBRARY = [
  {
    id: "litepaper-en",
    kind: "pdf" as const,
    href: PDF_DOWNLOAD_PATHS.en,
    localeTag: "EN",
  },
  {
    id: "litepaper-zh",
    kind: "pdf" as const,
    href: PDF_DOWNLOAD_PATHS.zh,
    localeTag: "ZH",
  },
  {
    id: "economic-en-pdf",
    kind: "pdf" as const,
    href: ECONOMIC_MODEL_PDF_PATHS.en,
    localeTag: "EN",
  },
  {
    id: "economic-zh-pdf",
    kind: "pdf" as const,
    href: ECONOMIC_MODEL_PDF_PATHS.zh,
    localeTag: "ZH",
  },
  {
    id: "economic-en-md",
    kind: "md" as const,
    href: ECONOMIC_MODEL_MD_PATHS.en,
    localeTag: "EN",
  },
  {
    id: "economic-zh-md",
    kind: "md" as const,
    href: ECONOMIC_MODEL_MD_PATHS.zh,
    localeTag: "ZH",
  },
] as const;
