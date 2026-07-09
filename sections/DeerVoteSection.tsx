"use client";

import { m, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { FadeIn } from "@/components/FadeIn";
import { Mascot } from "@/components/Mascot";
import { Section } from "@/components/Section";
import { DEER_VOTE_REVEAL_MS } from "@/content/i18n";
import { useLocale } from "@/context/LocaleContext";
import { useDeerVote } from "@/hooks/useDeerVote";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";
import { COMMUNITY_X_HANDLE, COMMUNITY_X_URL } from "@/lib/deer-trail";
import { getDeerVoteShareUrl } from "@/lib/deer-vote-share";
import { EASE } from "@/lib/motion";
import type { DeerVoteChoice } from "@/content/i18n/types";

const optionClass =
  "inline-flex min-w-[9rem] items-center justify-center border border-border px-6 py-4 font-[family-name:var(--font-noto-sans-tc)] text-base text-foreground transition-opacity sm:min-w-[10rem] sm:px-8 sm:py-4 sm:text-lg";

const actionButtonClass =
  "inline-flex min-w-[9rem] items-center justify-center border border-border px-6 py-3 font-[family-name:var(--font-anton)] text-xs tracking-[0.2em] text-foreground sm:text-sm";

const identityIllustrationClass =
  "mx-auto h-[12.5rem] w-[12.5rem] sm:h-[15rem] sm:w-[15rem] md:h-[17.5rem] md:w-[17.5rem] lg:h-[20rem] lg:w-[20rem]";

type DeerVoteResultProps = {
  choice: DeerVoteChoice;
  justVoted: boolean;
  onReset: () => void;
};

function DeerVoteResult({ choice, justVoted, onReset }: DeerVoteResultProps) {
  const reduceMotion = useReducedMotion();
  const { locale, t } = useLocale();
  const result = t.deerVote.results[choice];
  const [revealed, setRevealed] = useState(!justVoted);
  const completedTracked = useRef(false);

  useEffect(() => {
    completedTracked.current = false;
  }, [choice]);

  useEffect(() => {
    if (!justVoted || reduceMotion) {
      setRevealed(true);
      return;
    }

    setRevealed(false);
    const timer = window.setTimeout(() => setRevealed(true), DEER_VOTE_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [choice, justVoted, reduceMotion]);

  useEffect(() => {
    if (!revealed || completedTracked.current) return;

    completedTracked.current = true;
    trackEvent(AnalyticsEvents.DEER_VOTE_COMPLETED, {
      identity: choice,
      returning: !justVoted,
    });
  }, [revealed, choice, justVoted]);

  return (
    <m.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.6, ease: EASE }}
      className="relative left-1/2 mt-16 w-screen max-w-[100vw] -translate-x-1/2 border-y border-border py-14 sm:mt-20 sm:py-16"
    >
      <div className="mx-auto max-w-3xl px-6 text-center">
        {!revealed ? (
          <m.p
            aria-hidden="true"
            animate={{ opacity: [0.35, 0.85, 0.35] }}
            transition={{
              duration: reduceMotion ? 0 : 1.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="font-[family-name:var(--font-noto-sans-tc)] text-2xl tracking-[0.3em] text-muted sm:text-3xl"
          >
            ···
          </m.p>
        ) : (
          <m.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.55, ease: EASE }}
            className="flex flex-col items-center"
          >
            <p className="font-[family-name:var(--font-anton)] text-sm tracking-[0.2em] text-muted sm:text-base">
              {result.heading}
            </p>
            <p className="mt-6 font-[family-name:var(--font-noto-sans-tc)] text-2xl text-foreground sm:text-3xl md:text-4xl">
              {result.identity}
            </p>
            <p className="mt-5 font-[family-name:var(--font-noto-sans-tc)] text-base leading-relaxed text-muted sm:text-lg">
              {result.flavor}
            </p>

            <div className="mt-14 font-[family-name:var(--font-noto-sans-tc)] leading-[1.75] sm:mt-16">
              <p className="text-base text-muted sm:text-lg">{t.deerVote.futureNote.lead}</p>
              <p className="mt-2 text-base font-semibold text-foreground sm:text-lg">
                {t.deerVote.futureNote.emphasis}
              </p>
            </div>

            <div className="mt-16 py-6 sm:mt-20 sm:py-8">
              <Mascot
                src={result.illustration}
                alt={result.title}
                floating
                className={identityIllustrationClass}
              />
            </div>

            <div className="mt-10 max-w-md font-[family-name:var(--font-noto-sans-tc)] leading-[1.75] sm:mt-12">
              <p className="text-sm text-foreground sm:text-base">
                {t.deerVote.shareRewardNotice.followPrefix}
                <a
                  href={COMMUNITY_X_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline decoration-border underline-offset-2 transition-opacity hover:opacity-80"
                >
                  {COMMUNITY_X_HANDLE}
                </a>
                {t.deerVote.shareRewardNotice.followSuffix}
              </p>
              <p className="mt-1 text-sm text-foreground sm:text-base">
                {t.deerVote.shareRewardNotice.shareLine}
              </p>
              {t.deerVote.shareRewardNotice.eligibilityLines.map((line) => (
                <p key={line} className="mt-1 text-sm text-foreground sm:text-base">
                  {line}
                </p>
              ))}
            </div>

            <m.a
              href={getDeerVoteShareUrl(choice, locale)}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={reduceMotion ? undefined : { opacity: 0.7 }}
              transition={{ duration: 0.2 }}
              className={`${actionButtonClass} mt-8`}
              onClick={() =>
                trackEvent(AnalyticsEvents.SHARE_X_CLICKED, { context: "deer-vote" })
              }
            >
              {t.contract.shareOnX}
            </m.a>

            <div className="mt-10 w-full max-w-md border-t border-border pt-10 sm:mt-12">
              <m.button
                type="button"
                whileHover={reduceMotion ? undefined : { opacity: 0.7 }}
                transition={{ duration: 0.2 }}
                className={actionButtonClass}
                onClick={onReset}
              >
                {t.deerVote.reset}
              </m.button>
            </div>
          </m.div>
        )}
      </div>
    </m.div>
  );
}

export function DeerVoteSection() {
  const reduceMotion = useReducedMotion();
  const { t } = useLocale();
  const { choice, vote, reset, ready, hasVoted, justVoted } = useDeerVote();

  const handleVote = (next: DeerVoteChoice) => {
    trackEvent(AnalyticsEvents.DEER_VOTE_STARTED);
    trackEvent(AnalyticsEvents.DEER_IDENTITY_SELECTED, { identity: next });
    vote(next);
  };

  return (
    <FadeIn as="section" id="deer-vote">
      <Section ariaLabelledBy="deer-vote-title" className="flex flex-col items-center py-0 text-center">
        <h2
          id="deer-vote-title"
          className="font-[family-name:var(--font-noto-sans-tc)] text-[clamp(1.75rem,5vw,3rem)] tracking-[0.08em] text-foreground"
        >
          {t.deerVote.title}
        </h2>

        {ready && !hasVoted && (
          <div
            className="mt-16 flex w-full max-w-3xl flex-col items-stretch gap-4 sm:mt-20 sm:flex-row sm:justify-center sm:gap-5"
            role="group"
            aria-label={t.a11y.deerVoteGroup}
          >
            {t.deerVote.options.map((option) => (
              <m.button
                key={option.id}
                type="button"
                whileHover={reduceMotion ? undefined : { opacity: 0.7 }}
                transition={{ duration: 0.2 }}
                className={optionClass}
                onClick={() => handleVote(option.id)}
              >
                {option.display}
              </m.button>
            ))}
          </div>
        )}

        {ready && hasVoted && choice && (
          <DeerVoteResult choice={choice} justVoted={justVoted} onReset={reset} />
        )}
      </Section>
    </FadeIn>
  );
}
