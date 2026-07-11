"use client";

import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { useLocale } from "@/context/LocaleContext";

export function FaqSection() {
  const { t } = useLocale();

  return (
    <FadeIn as="section" id="faq">
      <Section ariaLabelledBy="faq-title" className="flex flex-col items-center py-0 text-center">
        <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold-light sm:text-sm">
          {t.faq.eyebrow}
        </p>
        <h2
          id="faq-title"
          className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(2.5rem,8vw,5rem)] tracking-[0.08em] text-foreground"
        >
          {t.faq.title}
        </h2>

        <dl className="mt-14 w-full max-w-3xl space-y-4 text-left sm:mt-16">
          {t.faq.items.map((item, index) => (
            <div
              key={item.question}
              className={`gold-border rounded-2xl px-6 py-6 sm:px-8 sm:py-7 ${
                index === 0 ? "meme-faq-highlight" : ""
              }`}
            >
              <dt className="font-[family-name:var(--font-anton)] text-base tracking-[0.06em] text-foreground sm:text-lg">
                {item.question}
              </dt>
              <dd className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </FadeIn>
  );
}
