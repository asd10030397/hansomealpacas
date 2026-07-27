"use client";

import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";
import { LitepaperHero } from "@/components/litepaper/LitepaperHero";
import { LitepaperDesktopNav, LitepaperMobileNav } from "@/components/litepaper/LitepaperNav";
import { LitepaperSection } from "@/components/litepaper/LitepaperSection";
import { LitepaperFaqAccordion } from "@/components/litepaper/LitepaperFaqAccordion";
import { LitepaperDocumentsLibrary } from "@/components/litepaper/LitepaperDocumentsLibrary";
import {
  LitepaperActiveSectionProvider,
  useLitepaperActiveSection,
} from "@/components/litepaper/LitepaperActiveSectionContext";
import { TokenomicsDiagram } from "@/components/litepaper/diagrams/TokenomicsDiagram";
import { LifecycleDiagram } from "@/components/litepaper/diagrams/LifecycleDiagram";
import { RoadmapTimeline } from "@/components/litepaper/diagrams/RoadmapTimeline";
import { FlywheelDiagram } from "@/components/litepaper/diagrams/FlywheelDiagram";
import {
  ECONOMIC_MODEL_PDF_PATHS,
  GAMEPLAY_OVERVIEW_IMAGE,
  LITEPAPER_SECTION_ORDER,
  PRODUCT_STATUS_STYLES,
  REVENUE_STATUS_STYLES,
} from "@/content/litepaper";

function StatusBadge({ statusKey, status }: { statusKey: string; status: string }) {
  return (
    <span
      className={`border px-2.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide ${PRODUCT_STATUS_STYLES[statusKey] ?? ""}`}
    >
      {status}
    </span>
  );
}

function LitepaperContent() {
  const { t, locale } = useLocale();
  const lp = t.litepaper;
  const { isTransitioning } = useLitepaperActiveSection();

  return (
    <div
      className={`min-w-0 flex-1 transition-opacity duration-300 ease-out ${isTransitioning ? "opacity-30" : "opacity-100"}`}
    >
      <LitepaperHero />

      <LitepaperSection id="founder-letter" eyebrow="00" title={lp.founderLetter.heading}>
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.founderLetter.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <p className="mt-6 text-sm font-medium text-[color:var(--lp-text-faint)]">{lp.founderLetter.signature}</p>
      </LitepaperSection>

      <LitepaperSection id="introduction" eyebrow="01" title={lp.introduction.heading}>
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.introduction.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="mt-10">
          <div className="lp-divider mb-8 w-16" />
          <h3 className="font-[family-name:var(--font-anton)] text-base tracking-wide text-[color:var(--lp-text)]">
            {lp.introduction.whatIsHansome.heading}
          </h3>
          <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            {lp.introduction.whatIsHansome.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </LitepaperSection>

      <LitepaperSection id="meme-identity" eyebrow="02" title={lp.memeIdentity.heading}>
        <p className="font-[family-name:var(--font-anton)] text-xl tracking-wide text-gold sm:text-2xl">
          {lp.memeIdentity.slogan}
        </p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text)] sm:text-base">
          {lp.memeIdentity.tagline}
        </p>
        <div className="mt-6 space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.memeIdentity.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {lp.memeIdentity.pillars.map((pillar) => (
            <div key={pillar.title} className="lp-card lp-card-hover rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gold">{pillar.title}</h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-[color:var(--lp-text-muted)]">{pillar.body}</p>
            </div>
          ))}
        </div>
      </LitepaperSection>

      <LitepaperSection id="brand-hierarchy" eyebrow="03" title={lp.brandHierarchy.heading}>
        <p className="text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.brandHierarchy.intro}
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {lp.brandHierarchy.items.map((item) => (
            <div key={item.name} className="lp-card lp-card-hover rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[color:var(--lp-text)]">{item.name}</h3>
                <StatusBadge statusKey={item.statusKey} status={item.status} />
              </div>
              <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-[color:var(--lp-text-muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </LitepaperSection>

      <LitepaperSection id="scan-score" eyebrow="04" title={lp.scanScore.heading}>
        <div className="mb-4">
          <StatusBadge statusKey="inDevelopment" status={lp.scanScore.status} />
        </div>
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.scanScore.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-gold">
          {lp.scanScore.principlesHeading}
        </h3>
        <ul className="mt-3 space-y-2 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.scanScore.principles.map((item) => (
            <li key={item}>{"\u2022"} {item}</li>
          ))}
        </ul>

        <div className="mt-12">
          <div className="lp-divider mb-8 w-16" />
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-[family-name:var(--font-anton)] text-base tracking-wide text-[color:var(--lp-text)]">
              {lp.scanScore.v4LockIntelligence.heading}
            </h3>
            <StatusBadge statusKey="inDevelopment" status={lp.scanScore.v4LockIntelligence.status} />
          </div>
          <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            {lp.scanScore.v4LockIntelligence.problem.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          <h4 className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-gold">
            {lp.scanScore.v4LockIntelligence.capabilitiesHeading}
          </h4>
          <ul className="mt-3 space-y-2 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            {lp.scanScore.v4LockIntelligence.capabilities.map((item) => (
              <li key={item}>{"\u2022"} {item}</li>
            ))}
          </ul>

          <h4 className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-gold">
            {lp.scanScore.v4LockIntelligence.statusesHeading}
          </h4>
          <ul className="mt-3 space-y-2 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            {lp.scanScore.v4LockIntelligence.statuses.map((item) => (
              <li key={item}>{"\u2022"} {item}</li>
            ))}
          </ul>

          <h4 className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-gold">
            {lp.scanScore.v4LockIntelligence.interpretationHeading}
          </h4>
          <ul className="mt-3 space-y-2 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            {lp.scanScore.v4LockIntelligence.interpretation.map((item) => (
              <li key={item}>{"\u2022"} {item}</li>
            ))}
          </ul>

          <div className="mt-6 space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            {lp.scanScore.v4LockIntelligence.whyItMatters.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          <h4 className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-gold">
            {lp.scanScore.v4LockIntelligence.scoreRelationshipHeading}
          </h4>
          <ul className="mt-3 space-y-2 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            {lp.scanScore.v4LockIntelligence.scoreRelationship.map((item) => (
              <li key={item}>{"\u2022"} {item}</li>
            ))}
          </ul>

          <p className="mt-6 text-xs leading-relaxed text-[color:var(--lp-text-faint)]">
            {lp.scanScore.v4LockIntelligence.maturityNote}
          </p>
        </div>
      </LitepaperSection>

      <LitepaperSection id="axes-confidence" eyebrow="05" title={lp.axesConfidence.heading}>
        <p className="text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.axesConfidence.intro}
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {lp.axesConfidence.axes.map((axis) => (
            <div key={axis.title} className="lp-card rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gold">{axis.title}</h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-[color:var(--lp-text-muted)]">{axis.body}</p>
            </div>
          ))}
        </div>
        <h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-gold">
          {lp.axesConfidence.principlesHeading}
        </h3>
        <ul className="mt-3 space-y-2 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.axesConfidence.principles.map((item) => (
            <li key={item}>{"\u2022"} {item}</li>
          ))}
        </ul>
      </LitepaperSection>

      <LitepaperSection id="explore" eyebrow="06" title={lp.explore.heading}>
        <div className="mb-4">
          <StatusBadge statusKey="planned" status={lp.explore.status} />
        </div>
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.explore.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </LitepaperSection>

      <LitepaperSection id="hansome-utility" eyebrow="07" title={lp.hansomeUtility.heading}>
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.hansomeUtility.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {lp.hansomeUtility.items.map((item) => (
            <div key={item.title} className="lp-card lp-card-hover rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gold">{item.title}</h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-[color:var(--lp-text-muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </LitepaperSection>

      <LitepaperSection id="tokenomics" eyebrow="08" title={lp.tokenomics.heading}>
        <div className="mb-10">
          <TokenomicsDiagram />
        </div>

        <div className="space-y-8 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gold">
              {lp.tokenomics.totalSupply.heading}
            </h3>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--lp-text)]">{lp.tokenomics.totalSupply.value}</p>
            <p className="mt-2">{lp.tokenomics.totalSupply.body}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gold">
              {lp.tokenomics.distribution.heading}
            </h3>
            <p className="mt-2">{lp.tokenomics.distribution.body}</p>
            <div className="lp-card mt-4 divide-y divide-wood/30 rounded-2xl">
              {lp.tokenomics.distribution.rows.map((row) => (
                <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-[color:var(--lp-text)]">{row.label}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--lp-text-faint)]">{row.note}</p>
                  </div>
                  <p className="text-sm font-semibold text-[color:var(--lp-text)]">{row.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[color:var(--lp-text-faint)]">
              {lp.tokenomics.distribution.footnote}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gold">
              {lp.tokenomics.whyFixedSupply.heading}
            </h3>
            <p className="mt-2">{lp.tokenomics.whyFixedSupply.body}</p>
          </div>
        </div>
      </LitepaperSection>

      <LitepaperSection id="treasury" eyebrow="09" title={lp.treasury.heading}>
        <p className="text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">{lp.treasury.intro}</p>

        <div className="lp-card mt-6 divide-y divide-wood/30 rounded-2xl">
          {lp.treasury.lines.map((line) => (
            <div key={line.label} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-[color:var(--lp-text)]">{line.label}</p>
                <p className="text-xs font-medium text-[color:var(--lp-text-faint)]">{line.value}</p>
              </div>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[color:var(--lp-text-faint)]">{line.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <div className="lp-divider mb-8 w-16" />
          <h3 className="font-[family-name:var(--font-anton)] text-base tracking-wide text-[color:var(--lp-text)]">
            {lp.treasury.transparencyHeading}
          </h3>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            {lp.treasury.transparencyBody}
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {lp.treasury.wallets.map((wallet) => (
              <div key={wallet.title} className="lp-card rounded-xl px-4 py-3.5">
                <p className="text-sm font-medium text-[color:var(--lp-text)]">{wallet.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[color:var(--lp-text-faint)]">{wallet.purpose}</p>
                <p className="mt-2 text-xs font-medium text-gold">{wallet.allocation}</p>
              </div>
            ))}
          </div>

          <Link
            href="/transparency"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-gold underline decoration-gold/40 underline-offset-4 transition-colors hover:decoration-gold"
          >
            {lp.treasury.viewWallets}
          </Link>
        </div>
      </LitepaperSection>

      <LitepaperSection id="liquidity" eyebrow="10" title={lp.liquidity.heading}>
        <div className="space-y-8 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {[
            lp.liquidity.concentratedLiquidity,
            lp.liquidity.longTermStrategy,
            lp.liquidity.lpFees,
            lp.liquidity.onChainVerification,
            lp.liquidity.liquidityOptimization,
            lp.liquidity.improvedTradingExperience,
            lp.liquidity.multiplePositions,
            lp.liquidity.noReactiveChasing,
          ].map((block) => (
            <div key={block.heading}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gold">{block.heading}</h3>
              <p className="mt-2">{block.body}</p>
              {block.links ? (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                  {block.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gold underline decoration-gold/40 underline-offset-4 transition-colors hover:decoration-gold"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </LitepaperSection>

      <LitepaperSection id="revenue" eyebrow="11" title={lp.revenue.heading}>
        <p className="text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">{lp.revenue.intro}</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {lp.revenue.streams.map((stream) => (
            <div key={stream.id} className="lp-card lp-card-hover rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[color:var(--lp-text)]">{stream.title}</h3>
                <span
                  className={`border px-2.5 py-0.5 text-[0.625rem] font-medium ${REVENUE_STATUS_STYLES[stream.statusKey] ?? ""}`}
                >
                  {stream.status}
                </span>
              </div>
              <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-[color:var(--lp-text-muted)]">{stream.body}</p>
            </div>
          ))}
        </div>
      </LitepaperSection>

      <LitepaperSection id="roadmap" eyebrow="12" title={lp.roadmap.heading}>
        <p className="mb-8 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.roadmap.intro}
        </p>
        <RoadmapTimeline />
      </LitepaperSection>

      <LitepaperSection id="legacy" eyebrow="13" title={lp.legacy.heading}>
        <div className="mb-4">
          <StatusBadge statusKey="legacy" status={lp.legacy.status} />
        </div>
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.legacy.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="mt-12">
          <div className="lp-divider mb-8 w-16" />
          <h3 className="font-[family-name:var(--font-anton)] text-base tracking-wide text-[color:var(--lp-text)]">
            {lp.gameplayOverview.heading}
          </h3>
          <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            <p>{lp.gameplayOverview.opening}</p>
          </div>

          <figure className="mx-auto mt-8 w-full min-w-0 max-w-xl sm:mt-10">
            <img
              src={GAMEPLAY_OVERVIEW_IMAGE}
              alt={lp.gameplayOverview.imageAlt}
              className="lp-card mx-auto block h-auto w-full max-w-full rounded-2xl object-contain"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="mt-5 space-y-1.5 text-center">
              <p className="font-[family-name:var(--font-anton)] text-base tracking-wide text-[color:var(--lp-text)]">
                {lp.gameplayOverview.captionTitle}
              </p>
              {lp.gameplayOverview.captionLines.map((line) => (
                <p
                  key={line}
                  className="text-[0.875rem] leading-relaxed text-[color:var(--lp-text-muted)]"
                >
                  {line}
                </p>
              ))}
            </figcaption>
          </figure>

          <div className="mt-8 space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:mt-10 sm:text-base">
            {lp.gameplayOverview.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <ul className="space-y-2 pl-1">
              {lp.gameplayOverview.roles.map((role) => (
                <li key={role}>{role}</li>
              ))}
            </ul>
            <p>{lp.gameplayOverview.loopLabel}</p>
            {lp.gameplayOverview.closing.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          <div className="lp-card mt-10 rounded-2xl p-5 sm:p-7">
            <div className="lp-divider mb-6 w-16" />
            <h3 className="font-[family-name:var(--font-anton)] text-base tracking-wide text-[color:var(--lp-text)]">
              {lp.gameplayOverview.cta.heading}
            </h3>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
              {lp.gameplayOverview.cta.body}
            </p>
            <ul className="mt-4 space-y-1.5 text-[0.875rem] leading-relaxed text-[color:var(--lp-text-muted)]">
              {lp.gameplayOverview.cta.bullets.map((item) => (
                <li key={item}>{"\u2022"} {item}</li>
              ))}
            </ul>
            <Link
              href={lp.gameplayOverview.cta.href}
              className="pixel-btn mt-6 inline-flex items-center border border-wood bg-gradient-to-b from-gold-pale to-gold px-5 py-2.5 font-[family-name:var(--font-anton)] text-[0.7rem] tracking-[0.12em] text-wood-dark transition-opacity hover:opacity-95"
            >
              {lp.gameplayOverview.cta.button}
            </Link>
          </div>
        </div>

        <div className="mt-14">
          <div className="lp-divider mb-8 w-16" />
          <h3 className="font-[family-name:var(--font-anton)] text-base tracking-wide text-[color:var(--lp-text)]">
            {lp.gamefiEconomicModel.heading}
          </h3>
          <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            {lp.gamefiEconomicModel.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          <h4 className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-gold">
            {lp.gamefiEconomicModel.highlightsHeading}
          </h4>
          <ul className="mt-3 space-y-2 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            {lp.gamefiEconomicModel.highlights.map((item) => (
              <li key={item}>{"\u2022"} {item}</li>
            ))}
          </ul>

          <p className="mt-6 text-xs leading-relaxed text-[color:var(--lp-text-faint)]">
            {lp.gamefiEconomicModel.disclaimer}
          </p>

          <div className="mt-6">
            <a
              href={ECONOMIC_MODEL_PDF_PATHS[locale]}
              download
              className="pixel-btn inline-flex items-center border border-wood bg-gradient-to-b from-gold-pale to-gold px-5 py-2.5 font-[family-name:var(--font-anton)] text-[0.7rem] tracking-[0.12em] text-wood-dark transition-opacity hover:opacity-95"
            >
              {lp.downloadEconomicModelPdf} ↓
            </a>
            <a
              href={lp.gamefiEconomicModel.hrefs.game}
              className="ml-3 inline-flex items-center text-sm text-gold underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {lp.gamefiEconomicModel.links.game}
            </a>
          </div>
        </div>

        <div className="mt-14">
          <div className="lp-divider mb-8 w-16" />
          <h3 className="font-[family-name:var(--font-anton)] text-base tracking-wide text-[color:var(--lp-text)]">
            {lp.sustainableEcosystem.heading}
          </h3>
          <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
            {lp.sustainableEcosystem.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <ul className="space-y-2 pl-1">
              {lp.sustainableEcosystem.investments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {lp.sustainableEcosystem.closing.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          <div className="mt-10">
            <div className="lp-divider mb-8 w-16" />
            <FlywheelDiagram />
          </div>
        </div>
      </LitepaperSection>

      <LitepaperSection id="community" eyebrow="14" title={lp.community.heading}>
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.community.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </LitepaperSection>

      <LitepaperSection id="long-term-vision" eyebrow="15" title={lp.longTermVision.heading}>
        <p className="text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">{lp.longTermVision.intro}</p>

        <div className="my-10">
          <LifecycleDiagram />
        </div>

        <p className="text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">{lp.longTermVision.closing}</p>
      </LitepaperSection>

      <LitepaperSection id="faq" eyebrow="16" title={lp.faq.heading}>
        <LitepaperFaqAccordion />
      </LitepaperSection>

      <LitepaperSection id="documents" eyebrow="DOC" title={lp.documentsLibrary.heading}>
        <p className="mb-6 text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">
          {lp.documentsLibrary.blurb}
        </p>
        <LitepaperDocumentsLibrary />
      </LitepaperSection>

      <LitepaperSection id="changelog" eyebrow="17" title={lp.changelog.heading}>
        <p className="text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">{lp.changelog.intro}</p>

        <ol className="mt-6 space-y-6">
          {lp.changelog.entries.map((entry) => (
            <li key={entry.version} className="lp-card rounded-2xl p-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-[family-name:var(--font-anton)] text-sm text-gold">{entry.version}</span>
                <span className="text-xs text-[color:var(--lp-text-faint)]">{entry.date}</span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {entry.changes.map((change) => (
                  <li key={change} className="text-[0.8125rem] leading-relaxed text-[color:var(--lp-text-muted)]">
                    · {change}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </LitepaperSection>

      <LitepaperSection id="language" eyebrow="18" title={lp.language.heading}>
        <p className="text-[0.9375rem] leading-relaxed text-[color:var(--lp-text-muted)] sm:text-base">{lp.language.body}</p>
      </LitepaperSection>

      <div className="py-16 text-center">
        <div className="lp-divider mx-auto mb-12 w-16" />
        <p className="mx-auto max-w-2xl text-sm text-[color:var(--lp-text-faint)]">{lp.closing.note}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-gold underline decoration-gold/40 underline-offset-4 hover:decoration-gold"
          >
            {lp.closing.home}
          </Link>
          <Link
            href="/transparency"
            className="text-sm font-medium text-gold underline decoration-gold/40 underline-offset-4 hover:decoration-gold"
          >
            {lp.closing.transparency}
          </Link>
          <Link
            href="/swap"
            className="text-sm font-medium text-gold underline decoration-gold/40 underline-offset-4 hover:decoration-gold"
          >
            {lp.closing.swap}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function LitepaperDoc() {
  return (
    <LitepaperActiveSectionProvider sectionIds={LITEPAPER_SECTION_ORDER}>
      <LitepaperMobileNav />
      <div className="litepaper-layout mx-auto flex max-w-5xl gap-12 px-6 pb-8 pt-8 sm:pt-14">
        <LitepaperDesktopNav />
        <LitepaperContent />
      </div>
    </LitepaperActiveSectionProvider>
  );
}
