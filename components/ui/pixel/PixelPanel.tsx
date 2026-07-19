import type { ReactNode } from "react";

type Tone = "default" | "cougar" | "alpaca" | "center";

const tones: Record<Tone, string> = {
  default: "bg-[#1e2433]/88",
  cougar: "bg-[#1a2233]/90",
  alpaca: "bg-[#1a2a30]/86",
  center: "bg-[#161c28]/92",
};

export function PixelPanel({
  children,
  title,
  tone = "default",
  className = "",
  eyebrow,
}: {
  children: ReactNode;
  title?: string;
  tone?: Tone;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <section
      className={`pixel-border rounded-none p-3 sm:p-4 ${tones[tone]} ${className}`}
    >
      {eyebrow ? <p className="mock-chip mb-2">{eyebrow}</p> : null}
      {title ? <h2 className="pixel-title mb-3 text-[0.7rem] sm:text-xs">{title}</h2> : null}
      {children}
    </section>
  );
}
