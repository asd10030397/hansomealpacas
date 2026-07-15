import type { ReactNode } from "react";
import { FadeIn } from "@/components/FadeIn";

type LitepaperSectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function LitepaperSection({ id, eyebrow, title, children }: LitepaperSectionProps) {
  return (
    <FadeIn as="section" id={id} className="py-20 first:pt-0 sm:py-28">
      <div className="lp-divider mb-10 first:hidden sm:mb-14" />
      <p className="lp-eyebrow-chip px-2.5 py-1 font-[family-name:var(--font-anton)] text-[0.55rem] tracking-[0.2em]">
        {eyebrow}
      </p>
      <h2 className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(1.35rem,3.6vw,2.1rem)] leading-[1.3] tracking-tight text-[color:var(--lp-text)]">
        {title}
      </h2>
      <div className="mt-8 max-w-3xl sm:mt-10">{children}</div>
    </FadeIn>
  );
}
