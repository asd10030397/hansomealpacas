import type { Metadata } from "next";
import { LitepaperDoc } from "@/components/litepaper/LitepaperDoc";
import { en } from "@/content/i18n/en";
import { PROJECT } from "@/content/project";
import { isValidHttpUrl } from "@/lib/links";

const website = isValidHttpUrl(PROJECT.website) ? PROJECT.website.trim().replace(/\/$/, "") : "https://hansomealpacas.xyz";
const litepaperUrl = `${website}/litepaper`;

// This is a single bilingual page with a client-side language switch, not
// two separate routes — so both hreflang entries intentionally point at the
// same URL. That's a deliberate, documented pattern for language-toggle
// pages (see https://developers.google.com/search/docs/specialty/international/localized-versions),
// not an oversight.
export const metadata: Metadata = {
  title: en.litepaper.meta.title,
  description: en.litepaper.meta.description,
  alternates: {
    canonical: litepaperUrl,
    languages: {
      en: litepaperUrl,
      "zh-CN": litepaperUrl,
      "x-default": litepaperUrl,
    },
  },
  openGraph: {
    title: en.litepaper.meta.title,
    description: en.litepaper.meta.description,
    url: litepaperUrl,
    siteName: PROJECT.name,
    type: "article",
    locale: "en_US",
    alternateLocale: ["zh_TW"],
  },
  twitter: {
    card: "summary",
    title: en.litepaper.meta.title,
    description: en.litepaper.meta.description,
  },
};

export default function LitepaperPage() {
  return (
    <main id="main-content">
      <LitepaperDoc />
    </main>
  );
}
