"use client";

import { useLocale } from "@/context/LocaleContext";
import {
  ECONOMIC_MODEL_MD_PATHS,
  ECONOMIC_MODEL_PDF_PATHS,
  PDF_DOWNLOAD_PATHS,
} from "@/content/litepaper";

type DocRow = {
  id: string;
  label: string;
  href: string;
  kind: "pdf" | "md";
  download?: boolean;
};

export function LitepaperDocumentsLibrary() {
  const { t } = useLocale();
  const lib = t.litepaper.documentsLibrary;

  const rows: DocRow[] = [
    {
      id: "litepaper-en",
      label: lib.litepaperEn,
      href: PDF_DOWNLOAD_PATHS.en,
      kind: "pdf",
      download: true,
    },
    {
      id: "litepaper-zh",
      label: lib.litepaperZh,
      href: PDF_DOWNLOAD_PATHS.zh,
      kind: "pdf",
      download: true,
    },
    {
      id: "economic-en-pdf",
      label: lib.economicPdfEn,
      href: ECONOMIC_MODEL_PDF_PATHS.en,
      kind: "pdf",
      download: true,
    },
    {
      id: "economic-zh-pdf",
      label: lib.economicPdfZh,
      href: ECONOMIC_MODEL_PDF_PATHS.zh,
      kind: "pdf",
      download: true,
    },
    {
      id: "economic-en-md",
      label: lib.economicMdEn,
      href: ECONOMIC_MODEL_MD_PATHS.en,
      kind: "md",
    },
    {
      id: "economic-zh-md",
      label: lib.economicMdZh,
      href: ECONOMIC_MODEL_MD_PATHS.zh,
      kind: "md",
    },
  ];

  return (
    <ul className="divide-y divide-wood/30 overflow-hidden rounded-xl border border-wood/30">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-3 bg-[color:var(--lp-surface)]/40 px-4 py-3.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-[color:var(--lp-text)]">{row.label}</p>
            <p className="mt-0.5 truncate font-mono text-[0.7rem] text-[color:var(--lp-text-faint)]">
              {row.href}
            </p>
          </div>
          <a
            href={row.href}
            {...(row.download ? { download: true } : { target: "_blank", rel: "noopener noreferrer" })}
            className="pixel-btn inline-flex shrink-0 items-center border border-wood bg-gradient-to-b from-gold-pale to-gold px-3.5 py-1.5 font-[family-name:var(--font-anton)] text-[0.65rem] tracking-[0.1em] text-wood-dark transition-opacity hover:opacity-95"
          >
            {row.kind === "pdf" ? "PDF ↓" : lib.openInBrowser}
          </a>
        </li>
      ))}
    </ul>
  );
}
