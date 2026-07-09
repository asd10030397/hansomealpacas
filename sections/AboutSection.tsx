import { ABOUT_LINES } from "@/content/about";
import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";

export function AboutSection() {
  return (
    <FadeIn as="section" id="about">
      <Section ariaLabelledBy="about-title" className="flex flex-col items-center py-0 text-center">
        <h2
          id="about-title"
          className="font-[family-name:var(--font-anton)] text-[clamp(2rem,6vw,3.75rem)] tracking-[0.1em] text-foreground"
        >
          WHO IS KAIRU?
        </h2>

        <div className="mt-16 space-y-5 sm:mt-20 sm:space-y-6">
          {ABOUT_LINES.map((line) => (
            <p key={line} className="text-lg text-muted sm:text-xl md:text-2xl">
              {line}
            </p>
          ))}
        </div>
      </Section>
    </FadeIn>
  );
}
