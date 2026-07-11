"use client";

import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";
import { getContractState } from "@/lib/launch";
import { shortenContractAddress } from "@/lib/links";

export function ContractSection() {
  const { t } = useLocale();
  const contract = getContractState();

  return (
    <FadeIn as="section" id="contract">
      <Section ariaLabelledBy="contract-title" className="flex flex-col items-center py-0 text-center">
        <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold sm:text-sm">
          {t.contract.eyebrow}
        </p>
        <h2
          id="contract-title"
          className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(2.5rem,8vw,5rem)] tracking-[0.08em] text-foreground"
        >
          {t.contract.title}
        </h2>
        <p className="mt-6 max-w-2xl text-base text-muted sm:text-xl">{t.contract.subtitle}</p>

        <div className="gold-border mt-14 w-full max-w-3xl rounded-2xl bg-white/[0.02] px-6 py-10 sm:mt-16 sm:px-10 sm:py-12">
          <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.28em] text-gold">
            {t.contract.addressLabel}
          </p>

          <div className="mt-6 flex flex-col items-center gap-6">
            <div className="w-full overflow-hidden rounded-xl border border-border bg-background/80 px-4 py-6 sm:px-6">
              <p
                className={`font-[family-name:var(--font-noto-sans-tc)] text-base sm:text-lg ${
                  contract.isLive
                    ? "font-mono text-sm tracking-wide text-foreground sm:text-base"
                    : "text-gold-light/90"
                }`}
                aria-live="polite"
              >
                {contract.isLive && contract.address
                  ? shortenContractAddress(contract.address)
                  : t.contract.placeholder}
              </p>
            </div>

            {contract.isLive && contract.address ? (
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                <CopyButton value={contract.address} variant="gold" showAddress={false} />
                {contract.explorerUrl ? (
                  <a
                    href={contract.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center border border-gold/35 bg-gold/5 px-8 py-3.5 font-[family-name:var(--font-anton)] text-sm tracking-[0.18em] text-gold-light transition-all duration-200 hover:border-gold/55"
                  >
                    {t.contract.viewExplorer}
                  </a>
                ) : null}
                <Link
                  href="/transparency"
                  className="inline-flex items-center justify-center border border-gold/35 bg-gold/5 px-8 py-3.5 font-[family-name:var(--font-anton)] text-sm tracking-[0.18em] text-gold-light transition-all duration-200 hover:border-gold/55"
                >
                  {t.contract.viewOfficialWallets}
                </Link>
              </div>
            ) : (
              <CopyButton value={null} variant="gold" />
            )}
          </div>
        </div>
      </Section>
    </FadeIn>
  );
}
