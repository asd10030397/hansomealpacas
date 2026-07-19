"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "gold" | "green" | "slate" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  gold: "bg-[#e8b03a] text-[#1a1520] border-[#9a6a12] hover:bg-[#f0c44a]",
  green: "bg-[#3f9e4a] text-[#f3ebe0] border-[#24632c] hover:bg-[#4bb557]",
  slate: "bg-[#3a455c] text-[#f3ebe0] border-[#1a2030] hover:bg-[#4a5670]",
  danger: "bg-[#c44b3a] text-[#f3ebe0] border-[#7a281c] hover:bg-[#d85a48]",
  ghost: "bg-transparent text-[#f3ebe0] border-[#5a6478] hover:bg-white/5",
};

type Props = {
  children: ReactNode;
  variant?: Variant;
  href?: string;
  disabled?: boolean;
  className?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

const sizes = {
  sm: "px-3 py-2 text-[0.55rem]",
  md: "px-4 py-3 text-[0.62rem]",
  lg: "px-5 py-4 text-[0.7rem]",
};

export function PixelButton({
  children,
  variant = "slate",
  href,
  disabled,
  className = "",
  subtitle,
  size = "md",
  type = "button",
  ...rest
}: Props) {
  const base = [
    "pixel-title inline-flex flex-col items-center justify-center gap-1",
    "border-[3px] shadow-[3px_3px_0_0_#0a0c12]",
    "transition-[transform,filter,box-shadow] duration-100",
    "hover:brightness-110 motion-safe:hover:-translate-y-px",
    "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none active:brightness-95",
    "disabled:opacity-40 disabled:pointer-events-none disabled:grayscale disabled:hover:translate-y-0 disabled:hover:brightness-100",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c44a]",
    "aria-busy:cursor-wait",
    variants[variant],
    sizes[size],
    className,
  ].join(" ");

  const content = (
    <>
      <span>{children}</span>
      {subtitle ? (
        <span className="font-[family-name:var(--font-body)] text-[0.65rem] font-normal tracking-normal opacity-80 normal-case">
          {subtitle}
        </span>
      ) : null}
    </>
  );

  if (href && !disabled) {
    const external = /^https?:\/\//i.test(href);
    if (external) {
      return (
        <a
          href={href}
          className={base}
          target="_blank"
          rel="noopener noreferrer"
        >
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={base} aria-disabled={disabled}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={base} disabled={disabled} {...rest}>
      {content}
    </button>
  );
}
