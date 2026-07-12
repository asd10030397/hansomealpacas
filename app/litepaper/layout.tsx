import type { ReactNode } from "react";
import { Inter } from "next/font/google";

// Scoped to /litepaper only — the rest of the site keeps its pixel-farm
// theme and Press Start 2P display font untouched. This route deliberately
// uses a different, calmer register (dark, large type, generous whitespace)
// because it's a trust document, not the meme homepage.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-litepaper",
  display: "swap",
});

export default function LitepaperLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${inter.variable} litepaper-print min-h-screen bg-black font-[family-name:var(--font-litepaper)] text-white antialiased`}
    >
      {children}
    </div>
  );
}
