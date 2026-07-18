import type { ReactNode } from "react";

export function PixelTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-[220px] -translate-x-1/2 border-2 border-[#0d1018] bg-[#1a1520] px-2 py-1 text-[0.65rem] text-[#f3ebe0] shadow-[2px_2px_0_#0d1018] group-hover:block group-focus-within:block">
        {label}
      </span>
    </span>
  );
}
