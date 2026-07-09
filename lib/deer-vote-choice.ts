import type { DeerVoteChoice } from "@/content/i18n/types";

export function isDeerVoteChoice(value: string | null): value is DeerVoteChoice {
  return value === "one" || value === "three" || value === "five-plus";
}
