import type { ReactNode } from "react";

export function PixelBadge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "gold" | "green" | "danger" | "blue";
}) {
  const map = {
    slate: "bg-[#3a455c] text-[#f3ebe0]",
    gold: "bg-[#e8b03a] text-[#1a1520]",
    green: "bg-[#3f9e4a] text-[#f3ebe0]",
    danger: "bg-[#c44b3a] text-[#f3ebe0]",
    blue: "bg-[#3a6ea5] text-[#f3ebe0]",
  };
  return (
    <span
      className={`pixel-title inline-block border-2 border-[#0d1018] px-2 py-1 text-[0.5rem] shadow-[2px_2px_0_#0d1018] ${map[tone]}`}
    >
      {children}
    </span>
  );
}
