import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { REACTIONS } from "@/content/reactions";

export function ReactionSection() {
  return (
    <FadeIn as="section" id="reactions">
      <Section className="py-0">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-20 sm:grid-cols-4 sm:gap-y-0">
          {REACTIONS.map((reaction, index) => (
            <li key={reaction.label}>
              <FadeIn as="article" delay={index * 0.08} className="text-center">
                <p className="text-5xl sm:text-6xl" role="img" aria-label="unimpressed">
                  {reaction.emoji}
                </p>
                <p className="mt-5 font-[family-name:var(--font-anton)] text-xs tracking-[0.15em] text-muted sm:text-sm">
                  {reaction.label}
                </p>
              </FadeIn>
            </li>
          ))}
        </ul>
      </Section>
    </FadeIn>
  );
}
