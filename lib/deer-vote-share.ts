import type { DeerVoteChoice } from "@/content/i18n/types";
import {
  DEER_VOTE_SHARE_HANDLE,
  DEER_VOTE_SHARE_URL,
  getMessages,
  type Locale,
} from "@/content/i18n";

export function getDeerVoteShareUrl(choice: DeerVoteChoice, locale: Locale): string {
  const { shareTagline, results } = getMessages(locale).deerVote;
  const { shareLine } = results[choice];
  const text = [shareLine, "", shareTagline, "", DEER_VOTE_SHARE_URL, "", DEER_VOTE_SHARE_HANDLE].join(
    "\n",
  );
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export { isDeerVoteChoice } from "@/lib/deer-vote-choice";
