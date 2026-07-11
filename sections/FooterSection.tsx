"use client";

import Link from "next/link";
import { FadeIn } from "@/components/FadeIn";
import { SocialBar } from "@/components/SocialBar";
import { PROJECT } from "@/content/project";
import { useLocale } from "@/context/LocaleContext";
import { getSocialLinks } from "@/lib/launch";

function FooterLink({ href, label }: { href?: string; label: string }) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm tracking-[0.12em] text-muted transition-colors duration-200 hover:text-gold-light sm:text-base"
    >
      {label}
    </a>
  );
}

function FooterInternalLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-sm tracking-[0.12em] text-muted transition-colors duration-200 hover:text-gold-light sm:text-base"
    >
      {label}
    </Link>
  );
}

export function FooterSection() {
  const { t } = useLocale();
  const { twitter, telegram, website, explorer } = getSocialLinks();

  return (
    <footer className="relative border-t border-border/80 px-6 pb-16 pt-24 sm:pb-20 sm:pt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
      />
      <FadeIn className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <p className="font-[family-name:var(--font-anton)] text-3xl tracking-[0.08em] text-foreground sm:text-4xl">
          {PROJECT.name}
        </p>

        <p className="mt-4 text-base text-muted sm:text-lg">{t.footer.tagline}</p>

        <p className="mt-6 text-sm tracking-[0.14em] text-gold/75 sm:text-base">{t.footer.builtOn}</p>

        <nav
          aria-label={t.a11y.socialLinks}
          className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
        >
          <FooterLink href={twitter} label={t.hero.x} />
          <FooterLink href={telegram} label={t.hero.telegram} />
          <FooterLink href={website} label={t.hero.website} />
          <FooterInternalLink href="/transparency" label={t.footer.transparency} />
          <FooterLink href={explorer} label={t.footer.explorer} />
        </nav>

        <div className="mt-8 space-y-1.5 text-sm text-muted/85 sm:text-base">
          <p>{t.footer.memeLovers}</p>
          <p>{t.footer.notFinancialAdvice}</p>
          <p className="font-[family-name:var(--font-anton)] tracking-[0.12em] text-gold/90">
            {t.footer.stayUgly}
          </p>
        </div>

        <SocialBar className="mt-10" size="sm" />

        <p className="mt-14 max-w-3xl text-[0.6875rem] leading-relaxed tracking-wide text-muted/70 sm:text-xs">
          {t.footer.disclaimer}
        </p>

        <p className="mt-8 text-xs tracking-wide text-muted/50">{t.footer.copyright}</p>
      </FadeIn>
    </footer>
  );
}
