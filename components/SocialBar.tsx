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
  const { twitter, telegram, website } = getSocialLinks();
  const iconSize = size === "sm" ? "h-9 w-9" : "h-11 w-11";

  return (
    <nav
      aria-label={t.a11y.socialLinks}
      className={`flex items-center justify-center gap-3 sm:gap-4 ${className}`}
    >
      <SocialIcon href={twitter} label={t.hero.x} className={iconSize} variant="gold">
        <XIcon />
      </SocialIcon>
      <SocialIcon href={website} label={t.hero.website} className={iconSize} variant="gold">
        <WebsiteIcon />
      </SocialIcon>
      <SocialIcon href={telegram} label={t.hero.telegram} className={iconSize} variant="gold">
        <TelegramIcon />
      </SocialIcon>
    </nav>
  );
}
