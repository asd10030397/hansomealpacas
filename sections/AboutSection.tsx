import { ABOUT } from "@/content/about";
import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";

const gapClass = {
  lg: "mb-10 sm:mb-12",
  md: "mb-8 sm:mb-10",
  none: "",
} as const;

export function AboutSection() {
  return (
    <FadeIn as="section" id="about">
      <Section ariaLabelledBy="about-title" className="flex flex-col items-center py-0 text-center">
        <h2
          id="about-title"
          className="font-[family-name:var(--font-anton)] text-[clamp(2rem,6vw,3.75rem)] tracking-[0.1em] text-foreground"
        >
          {ABOUT.title}
        </h2>

        <p className="mt-8 font-[family-name:var(--font-noto-sans-tc)] text-lg text-muted sm:mt-10 sm:text-xl">
          {ABOUT.subtitle}
        </p>

        <div className="mt-16 max-w-2xl sm:mt-20">
          {ABOUT.blocks.map((block, index) => (
            <div
              key={index}
              className={`space-y-2 sm:space-y-3 ${gapClass[block.gapAfter]}`}
            >
              {block.lines.map((line) => (
                <p
                  key={line}
                  className="font-[family-name:var(--font-noto-sans-tc)] text-lg leading-relaxed text-foreground sm:text-xl md:text-2xl"
                >
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      </Section>
    </FadeIn>
  );
}
