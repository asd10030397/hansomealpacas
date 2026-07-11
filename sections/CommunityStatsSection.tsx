"use client";

import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";
import { getCommunityStatsState } from "@/lib/launch";
import type { CommunityStatKey } from "@/lib/links";

function CommunityStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="tokenomics-card flex min-h-[7.5rem] flex-col items-center justify-center rounded-2xl px-4 py-7 sm:min-h-[8rem] sm:px-5 sm:py-8">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-gold/70 sm:text-sm">{label}</p>
      <p className="mt-4 text-xl font-medium tabular-nums text-foreground sm:mt-5 sm:text-2xl">{value}</p>
    </div>
  );
}

export function CommunityStatsSection() {
  const { t } = useLocale();
  const { stats } = getCommunityStatsState();

  const labels: Record<CommunityStatKey, string> = {
    holders: t.community.holders,
    transactions: t.community.transactions,
    liquidity: t.community.liquidity,
    marketCap: t.community.marketCap,
  };

  return (
    <FadeIn as="section" id="community">
      <Section ariaLabelledBy="community-title" className="flex flex-col items-center py-0 text-center">
        <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold sm:text-sm">
          {t.community.eyebrow}
        </p>
        <h2
          id="community-title"
          className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(2.5rem,8vw,5rem)] tracking-[0.08em] text-foreground"
        >
          {t.community.title}
        </h2>

        <div className="mt-14 grid w-full max-w-4xl grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {stats.map((stat) => (
            <CommunityStatCard
              key={stat.key}
              label={labels[stat.key]}
              value={stat.value ?? t.community.comingSoon}
            />
          ))}
        </div>
      </Section>
    </FadeIn>
  );
}
