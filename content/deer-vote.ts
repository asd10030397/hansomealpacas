export type DeerVoteChoice = "one" | "three" | "five-plus";

export const DEER_VOTE = {
  title: "今天鹿幾發？",
  storageKey: "kairu:deer-vote",
  shareUrl: "https://kairu.lol",
  revealMs: 1250,
  futureNote: "正式發幣後，符合資格的鹿將可領取 KAIRU。",
  options: [
    { id: "one" as const, label: "1 發", display: "🦌 1 發" },
    { id: "three" as const, label: "3 發", display: "🦌🦌 3 發" },
    { id: "five-plus" as const, label: "5 發以上", display: "👑🦌 5 發以上" },
  ],
  results: {
    one: {
      heading: "1 發",
      identity: "你是小鹿。",
      flavor: "低調過活，偶爾現身。",
    },
    three: {
      heading: "3 發",
      identity: "你是公鹿。",
      flavor: "該出手時，絕不客氣。",
    },
    "five-plus": {
      heading: "5+",
      identity: "你是鹿天帝。",
      flavor: "天選之鹿，無需解釋。",
    },
  },
} as const;

export function getDeerVoteShareUrl(choice: DeerVoteChoice): string {
  const { identity } = DEER_VOTE.results[choice];
  const text = `${identity}\n我們都是 KAIRU。\n${DEER_VOTE.shareUrl}`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function isDeerVoteChoice(value: string | null): value is DeerVoteChoice {
  return value === "one" || value === "three" || value === "five-plus";
}
