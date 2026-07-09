"use client";

import { m, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import {
  DEER_VOTE,
  getDeerVoteShareUrl,
  type DeerVoteChoice,
} from "@/content/deer-vote";
import { useDeerVote } from "@/hooks/useDeerVote";
import { trackEvent } from "@/lib/analytics";
import { EASE } from "@/lib/motion";

const optionClass =
  "inline-flex min-w-[9rem] items-center justify-center border border-border px-6 py-4 font-[family-name:var(--font-noto-sans-tc)] text-base text-foreground transition-opacity sm:min-w-[10rem] sm:px-8 sm:py-4 sm:text-lg";

const actionButtonClass =
  "inline-flex min-w-[9rem] items-center justify-center border border-border px-6 py-3 font-[family-name:var(--font-anton)] text-xs tracking-[0.2em] text-foreground sm:text-sm";

type DeerVoteResultProps = {
  choice: DeerVoteChoice;
  justVoted: boolean;
};

function DeerVoteResult({ choice, justVoted }: DeerVoteResultProps) {
  const reduceMotion = useReducedMotion();
  const result = DEER_VOTE.results[choice];
  const [revealed, setRevealed] = useState(!justVoted);

  useEffect(() => {
    if (!justVoted || reduceMotion) {
      setRevealed(true);
      return;
    }

    setRevealed(false);
    const timer = window.setTimeout(() => setRevealed(true), DEER_VOTE.revealMs);
    return () => window.clearTimeout(timer);
  }, [choice, justVoted, reduceMotion]);

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
            <p className="mt-10 text-sm leading-relaxed text-muted sm:text-base">
              {DEER_VOTE.futureNote.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
            <div className="mt-8">
              <m.a
                href={getDeerVoteShareUrl(choice)}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={reduceMotion ? undefined : { opacity: 0.7 }}
                transition={{ duration: 0.2 }}
                className={actionButtonClass}
                onClick={() => trackEvent("share", { method: "x", context: "deer-vote" })}
              >
                SHARE ON X
              </m.a>
            </div>
          </m.div>
        )}
      </div>
    </m.div>
  );
}

export function DeerVoteSection() {
  const reduceMotion = useReducedMotion();
  const { choice, vote, reset, ready, hasVoted, justVoted } = useDeerVote();

  const handleVote = (next: DeerVoteChoice) => {
    vote(next);
  };

  return (
    <FadeIn as="section" id="deer-vote">
      <Section ariaLabelledBy="deer-vote-title" className="flex flex-col items-center py-0 text-center">
        <h2
          id="deer-vote-title"
          className="font-[family-name:var(--font-noto-sans-tc)] text-[clamp(1.75rem,5vw,3rem)] tracking-[0.08em] text-foreground"
        >
          {DEER_VOTE.title}
        </h2>

        {ready && !hasVoted && (
          <div
            className="mt-16 flex w-full max-w-3xl flex-col items-stretch gap-4 sm:mt-20 sm:flex-row sm:justify-center sm:gap-5"
            role="group"
            aria-label={DEER_VOTE.title}
          >
            {DEER_VOTE.options.map((option) => (
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
          <>
            <DeerVoteResult choice={choice} justVoted={justVoted} />
            <div className="mt-8">
              <m.button
                type="button"
                whileHover={reduceMotion ? undefined : { opacity: 0.7 }}
                transition={{ duration: 0.2 }}
                className={actionButtonClass}
                onClick={reset}
              >
                {DEER_VOTE.resetLabel}
              </m.button>
            </div>
          </>
        )}
      </Section>
    </FadeIn>
  );
}
