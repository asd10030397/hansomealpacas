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
      className={`mx-auto w-full max-w-6xl px-6 py-32 sm:py-40 md:py-48 ${className}`}
    >
      {children}
    </section>
  );
}
