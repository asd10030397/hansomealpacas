import type { ReactNode } from "react";

export function PixelCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`pixel-border bg-[#222a3c] p-3 transition-transform duration-100 hover:-translate-y-0.5 ${className}`}
    >
      {children}
    </div>
  );
}
