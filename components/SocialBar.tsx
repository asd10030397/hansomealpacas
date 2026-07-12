"use client";

import { SocialIcon, TelegramIcon, WebsiteIcon, XIcon } from "@/components/SocialIcon";
import { useLocale } from "@/context/LocaleContext";
import { getSocialLinks } from "@/lib/launch";

type SocialBarProps = {
  className?: string;
  size?: "sm" | "md";
};

export function SocialBar({ className = "", size = "md" }: SocialBarProps) {
  const { t } = useLocale();
  const { twitter, telegram } = getSocialLinks();
  const iconSize = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  // Center globe button intentionally points to the official DexScreener
  // pair page instead of the marketing website — only this href changed.
  const dexScreenerUrl =
    "https://dexscreener.com/robinhood/0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d";

  return (
    <nav
      aria-label={t.a11y.socialLinks}
      className={`flex items-center justify-center gap-3 sm:gap-4 ${className}`}
    >
      <SocialIcon href={twitter} label={t.hero.x} className={iconSize} variant="gold">
        <XIcon />
      </SocialIcon>
      <SocialIcon href={dexScreenerUrl} label={t.hero.website} className={iconSize} variant="gold">
        <WebsiteIcon />
      </SocialIcon>
      <SocialIcon href={telegram ?? "#"} label={t.hero.telegram} className={iconSize} variant="gold">
        <TelegramIcon />
      </SocialIcon>
    </nav>
  );
}
