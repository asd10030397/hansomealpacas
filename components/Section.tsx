import { type ReactNode } from "react";

type SectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  ariaLabelledBy?: string;
};

export function Section({ id, children, className = "", ariaLabelledBy }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      className={`mx-auto w-full max-w-5xl px-6 py-28 sm:py-36 md:py-44 ${className}`}
    >
      {children}
    </section>
  );
}
