import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DEV — Settlement Preview | HANSOME",
  robots: { index: false, follow: false },
};

/** Dev-only routes — not linked from production navigation. */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b1018] text-[#e8e4d8]">
      <div className="border-b border-[#2a3348] bg-[#121826] px-4 py-2 text-xs text-[#f0c44a]">
        DEV ONLY — not production navigation
      </div>
      {children}
    </div>
  );
}
