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
    <FadeIn as="section" id={id} className="border-t border-white/10 py-20 first:border-t-0 first:pt-0 sm:py-28">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/40">{eyebrow}</p>
      <h2 className="mt-3 text-[clamp(1.75rem,4.5vw,2.75rem)] font-semibold leading-[1.1] tracking-tight text-white">
        {title}
      </h2>
      <div className="mt-8 max-w-3xl sm:mt-10">{children}</div>
    </FadeIn>
  );
}
