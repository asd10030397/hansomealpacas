import { FadeIn } from "@/components/FadeIn";
import { SocialIcon, TelegramIcon, XIcon } from "@/components/SocialIcon";
import { PROJECT } from "@/content/project";
import { getFooterLinks } from "@/lib/launch";

export function FooterSection() {
  const { twitter, telegram } = getFooterLinks();

  return (
    <footer className="px-6 pb-16 pt-28 sm:pb-20 sm:pt-36">
      <FadeIn className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <p className="font-[family-name:var(--font-anton)] text-2xl tracking-[0.1em] text-foreground sm:text-3xl">
          {PROJECT.name}
        </p>

        <p className="mt-4 text-base text-muted sm:text-lg">{PROJECT.taglineCN}</p>

        {(twitter || telegram) && (
          <nav aria-label="Social links" className="mt-10 flex items-center gap-6">
            {twitter && (
              <SocialIcon href={twitter} label="X">
                <XIcon />
              </SocialIcon>
            )}
            {telegram && (
              <SocialIcon href={telegram} label="Telegram">
                <TelegramIcon />
              </SocialIcon>
            )}
          </nav>
        )}

        <p className="mt-16 text-xs tracking-wide text-muted/50">{PROJECT.copyright}</p>
      </FadeIn>
    </footer>
  );
}
