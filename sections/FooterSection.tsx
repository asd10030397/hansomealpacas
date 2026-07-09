"use client";

import { FadeIn } from "@/components/FadeIn";
import { SocialIcon, TelegramIcon, XIcon } from "@/components/SocialIcon";
import { PROJECT } from "@/content/project";
import { useLocale } from "@/context/LocaleContext";
import { getFooterLinks } from "@/lib/launch";

export function FooterSection() {
  const { t } = useLocale();
  const { twitter, telegram } = getFooterLinks();

  return (
    <footer className="px-6 pb-16 pt-28 sm:pb-20 sm:pt-36">
      <FadeIn className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <p className="font-[family-name:var(--font-anton)] text-2xl tracking-[0.1em] text-foreground sm:text-3xl">
          {PROJECT.name}
        </p>

        <p className="mt-4 text-base text-muted sm:text-lg">{t.footer.tagline}</p>

        {(twitter || telegram) && (
          <nav aria-label={t.a11y.socialLinks} className="mt-10 flex items-center gap-6">
            {twitter && (
              <SocialIcon href={twitter} label={t.hero.x}>
                <XIcon />
              </SocialIcon>
            )}
            {telegram && (
              <SocialIcon href={telegram} label={t.hero.telegram}>
                <TelegramIcon />
              </SocialIcon>
            )}
          </nav>
        )}

        <p className="mt-16 text-xs tracking-wide text-muted/50">{t.footer.copyright}</p>
      </FadeIn>
    </footer>
  );
}
