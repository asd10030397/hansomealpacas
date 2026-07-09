export type DeerVoteChoice = "one" | "three" | "five-plus";

export const DEER_VOTE = {
  title: "今天鹿幾發？",
  storageKey: "kairu:deer-vote",
  shareUrl: "https://kairu.lol",
  shareHandle: "@DeerloveRu",
  revealMs: 1250,
  resetLabel: "重新測一次",
  futureNote: {
    lead: "正式發幣後，",
    emphasis: "符合資格的鹿將可領取 KAIRU。",
  },
  options: [
    { id: "one" as const, label: "1 發", display: "🦌 1 發" },
    { id: "three" as const, label: "3 發", display: "🦌🦌 3 發" },
    { id: "five-plus" as const, label: "5 發以上", display: "👑🦌 5 發以上" },
  ],
  results: {
    one: {
      heading: "1 發",
      title: "小鹿",
      identity: "你是小鹿。",
      flavor: "低調過活，偶爾現身。",
      shareLine: "我是「小鹿」🦌",
      illustration: "/identities/kolittle.svg",
    },
    three: {
      heading: "3 發",
      title: "公鹿",
      identity: "你是公鹿。",
      flavor: "該出手時，絕不客氣。",
      shareLine: "我是「公鹿」🦌🦌",
      illustration: "/identities/stag.svg",
    },
    "five-plus": {
      heading: "5+",
      title: "鹿天帝",
      identity: "你是鹿天帝。",
      flavor: "天選之鹿，無需解釋。",
      shareLine: "我是「鹿天帝」🦌👑",
      illustration: "/identities/emperor.svg",
    },
  },
} as const;

export function getDeerVoteShareUrl(choice: DeerVoteChoice): string {
  const { shareLine } = DEER_VOTE.results[choice];
  const text = [
    shareLine,
    "",
    "我們都是 KAIRU。",
    "",
    DEER_VOTE.shareUrl,
    "",
    DEER_VOTE.shareHandle,
  ].join("\n");
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function isDeerVoteChoice(value: string | null): value is DeerVoteChoice {
  return value === "one" || value === "three" || value === "five-plus";
}
