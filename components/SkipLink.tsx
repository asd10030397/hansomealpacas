"use client";

import { usePathname } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";

export function SkipLink() {
  const { t } = useLocale();
  const pathname = usePathname();

  // Marketing skip target (#about) — hide on game routes
  if (pathname === "/game" || pathname.startsWith("/game/")) return null;

  return (
    <a
      href="#about"
      className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus:z-50 focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:text-foreground"
    >
      {t.a11y.skipToContent}
    </a>
  );
}
