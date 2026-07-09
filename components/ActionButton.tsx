"use client";

import { m } from "framer-motion";

type ActionButtonProps = {
  href?: string;
  disabled?: boolean;
  children: string;
};

export function ActionButton({ href, disabled = false, children }: ActionButtonProps) {
  const className =
    "inline-flex min-w-[7.5rem] items-center justify-center border border-border px-8 py-3 font-[family-name:var(--font-anton)] text-xs tracking-[0.25em] text-foreground sm:min-w-[8.5rem] sm:px-10 sm:py-3.5 sm:text-sm";

  if (!href && !disabled) {
    return null;
  }

  if (disabled || !href) {
    return (
      <span aria-disabled="true" className={`${className} cursor-default text-muted`}>
        {children}
      </span>
    );
  }

  return (
    <m.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ opacity: 0.7 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </m.a>
  );
}
