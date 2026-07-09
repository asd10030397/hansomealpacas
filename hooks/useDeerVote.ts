"use client";

import { useCallback, useEffect, useState } from "react";
import { DEER_VOTE_STORAGE_KEY } from "@/content/i18n";
import type { DeerVoteChoice } from "@/content/i18n/types";
import { isDeerVoteChoice } from "@/lib/deer-vote-choice";

export function useDeerVote() {
  const [choice, setChoice] = useState<DeerVoteChoice | null>(null);
  const [ready, setReady] = useState(false);
  const [justVoted, setJustVoted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DEER_VOTE_STORAGE_KEY);
      if (isDeerVoteChoice(stored)) {
        setChoice(stored);
      }
    } catch {
      /* private browsing or blocked storage */
    } finally {
      setReady(true);
    }
  }, []);

  const vote = useCallback((next: DeerVoteChoice) => {
    if (choice) return;

    setChoice(next);
    setJustVoted(true);
    try {
      localStorage.setItem(DEER_VOTE_STORAGE_KEY, next);
    } catch {
      /* still show result for this session */
    }
  }, [choice]);

  const reset = useCallback(() => {
    setChoice(null);
    setJustVoted(false);
    try {
      localStorage.removeItem(DEER_VOTE_STORAGE_KEY);
    } catch {
      /* private browsing or blocked storage */
    }
  }, []);

  return { choice, vote, reset, ready, hasVoted: choice !== null, justVoted };
}
