"use client";

import { useCallback, useEffect, useState } from "react";
import { DEER_VOTE, type DeerVoteChoice, isDeerVoteChoice } from "@/content/deer-vote";

export function useDeerVote() {
  const [choice, setChoice] = useState<DeerVoteChoice | null>(null);
  const [ready, setReady] = useState(false);
  const [justVoted, setJustVoted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DEER_VOTE.storageKey);
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
      localStorage.setItem(DEER_VOTE.storageKey, next);
    } catch {
      /* still show result for this session */
    }
  }, [choice]);

  return { choice, vote, ready, hasVoted: choice !== null, justVoted };
}
