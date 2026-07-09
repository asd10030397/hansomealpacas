"use client";

import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";
import { getDeerTrailItems } from "@/lib/deer-trail";

export function DeerTrailSection() {
  const { t } = useLocale();
  const items = getDeerTrailItems(t.deerTrail.items);

  return (
    <FadeIn as="section" id="deer-trail">
      <Section ariaLabelledBy="deer-trail-title" className="flex flex-col items-center py-0 text-center">
        <h2
          id="deer-trail-title"
          className="font-[family-name:var(--font-anton)] text-[clamp(2rem,6vw,3.75rem)] tracking-[0.1em] text-foreground"
        >
          {t.deerTrail.title}
        </h2>

        <ol className="mt-16 w-full max-w-md border-l border-border sm:mt-20">
          {items.map((item, index) => {
            const done = item.status === "done";

            return (
              <li
                key={item.id}
                className={`relative flex items-center gap-5 py-4 pl-8 sm:py-5 ${
                  index < items.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute -left-px top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-1 font-mono text-sm leading-none ${
                    done ? "text-foreground" : "text-muted"
                  }`}
                >
                  {done ? "✓" : "□"}
                </span>
                <span
                  className={`font-[family-name:var(--font-anton)] text-xs tracking-[0.15em] sm:text-sm ${
                    done ? "text-foreground" : "text-muted"
                  }`}
                >
                  {item.label}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-5 max-w-md text-[0.6875rem] leading-relaxed tracking-[0.06em] text-muted/60 sm:text-xs">
          {t.deerTrail.caption}
        </p>
      </Section>
    </FadeIn>
  );
}
