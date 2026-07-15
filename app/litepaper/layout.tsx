import type { ReactNode } from "react";
import { Inter } from "next/font/google";

// Scoped to /litepaper only. Body copy uses Inter for clean, comfortable
// long-form reading (falling back to the site's Noto Sans TC for Chinese
// glyphs Inter doesn't cover); headings/labels use the site-wide Press
// Start 2P pixel font (--font-anton, inherited from the root <html> class)
// so the document still reads as an official HANSOME publication — a dark,
// pixel-accented "game manual" built from the same wood/gold/cream palette
// as the rest of the site, rather than a generic dark-mode doc theme.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-litepaper",
  display: "swap",
});

export default function LitepaperLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${inter.variable} litepaper-print min-h-screen font-[family-name:var(--font-litepaper),var(--font-noto-sans-tc)] antialiased`}
      style={{ backgroundColor: "var(--lp-bg)", color: "var(--lp-text)" }}
    >
      {children}
    </div>
  );
}
