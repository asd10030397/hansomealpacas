"use client";

import { m } from "framer-motion";

type ActionButtonProps = {
  href?: string;
  disabled?: boolean;
  children: string;
  sublabel?: string;
  variant?: "default" | "gold";
  size?: "default" | "lg";
};

export function ActionButton({
  href,
  disabled = false,
  children,
  sublabel,
  variant = "default",
  size = "default",
}: ActionButtonProps) {
  const sizeClass =
    size === "lg"
      ? "min-w-[12rem] px-12 py-4 sm:min-w-[14rem] sm:px-14 sm:py-5"
      : "min-w-[9rem] px-8 py-3 sm:min-w-[10rem] sm:px-10 sm:py-3.5";

  const variantClass =
    variant === "gold"
      ? "border-gold/40 bg-gradient-to-b from-gold/20 to-gold/5 text-gold-light shadow-[0_0_32px_rgba(212,175,55,0.15)] hover:border-gold/60 hover:shadow-[0_0_40px_rgba(212,175,55,0.25)]"
      : "border-border text-foreground";

  const className = `inline-flex flex-col items-center justify-center gap-1 border font-[family-name:var(--font-anton)] transition-all duration-200 ${sizeClass} ${variantClass}`;
  const labelClass =
    size === "lg"
      ? "text-sm tracking-[0.18em] sm:text-base"
      : "text-xs tracking-[0.18em] sm:text-sm";
  const sublabelClass = "text-[0.62rem] tracking-[0.14em] opacity-75 sm:text-[0.68rem]";

  const content = (
    <>
      <span className={labelClass}>{children}</span>
      {sublabel ? <span className={sublabelClass}>{sublabel}</span> : null}
    </>
  );

  if (!href && !disabled) {
    return null;
  }

  if (disabled || !href) {
    return (
      <span aria-disabled="true" className={`${className} cursor-default opacity-70`}>
        {content}
      </span>
    );
  }

  return (
    <m.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.01, opacity: 0.94 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {content}
    </m.a>
  );
}
