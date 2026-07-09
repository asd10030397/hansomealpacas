export type DeerTrailStatus = "done" | "upcoming";

export type DeerTrailItem = {
  label: string;
  status: DeerTrailStatus;
};

export const DEER_TRAIL = {
  title: "DEER TRAIL",
  caption: "The story has only just begun.",
  items: [
    { label: "Website", status: "done" },
    { label: "Community", status: "upcoming" },
    { label: "Deer Identity", status: "done" },
    { label: "Token Launch", status: "upcoming" },
    { label: "Wallet Connect", status: "upcoming" },
    { label: "Claim KAIRU", status: "upcoming" },
    { label: "The Forest Grows", status: "upcoming" },
    { label: "???", status: "upcoming" },
  ] satisfies DeerTrailItem[],
} as const;
