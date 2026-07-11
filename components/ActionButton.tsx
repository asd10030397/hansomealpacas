"use client";

import { m } from "framer-motion";

type ActionButtonProps = {
  href?: string;
  disabled?: boolean;
  children: string;
  variant?: "default" | "gold";
  size?: "default" | "lg";
};

export function ActionButton({
  href,
  disabled = false,
  children,
  variant = "default",
  size = "default",
}: ActionButtonProps) {
  const sizeClass =
    size === "lg"
      ? "min-w-[12rem] px-12 py-4 text-sm sm:min-w-[14rem] sm:px-14 sm:py-5 sm:text-base"
      : "min-w-[7.5rem] px-8 py-3 text-xs sm:min-w-[8.5rem] sm:px-10 sm:py-3.5 sm:text-sm";

  const variantClass =
    variant === "gold"
      ? "border-gold/40 bg-gradient-to-b from-gold/20 to-gold/5 text-gold-light shadow-[0_0_32px_rgba(212,175,55,0.15)] hover:border-gold/60 hover:shadow-[0_0_40px_rgba(212,175,55,0.25)]"
      : "border-border text-foreground";

  const className = `inline-flex items-center justify-center border font-[family-name:var(--font-anton)] tracking-[0.25em] transition-all duration-200 ${sizeClass} ${variantClass}`;

  if (!href && !disabled) {
    return null;
  }

  if (disabled || !href) {
    return (
      <span
        aria-disabled="true"
        className={`${className} cursor-default opacity-70`}
      >
        {children}
      </span>
    );
  }

  return (
    <m.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.02, opacity: 0.92 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </m.a>
  );
}
