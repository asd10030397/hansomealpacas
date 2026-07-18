"use client";

import Image from "next/image";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = {
  children: ReactNode;
  subtitle?: string;
  iconSrc: string;
  href?: string;
  variant?: "gold" | "green";
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/**
 * Premium RPG title-screen menu button — gold frame, icon, hover glow, press.
 */
export function RpgMenuButton({
  children,
  subtitle,
  iconSrc,
  href,
  variant = "gold",
  className = "",
  type = "button",
  ...rest
}: Props) {
  const tone =
    variant === "green"
      ? "rpg-menu-btn--green"
      : "rpg-menu-btn--gold";

  const inner = (
    <>
      <span className="rpg-menu-btn__icon" aria-hidden>
        <Image src={iconSrc} alt="" width={28} height={28} unoptimized className="pixelated" />
      </span>
      <span className="rpg-menu-btn__text">
        <span className="rpg-menu-btn__label">{children}</span>
        {subtitle ? <span className="rpg-menu-btn__sub">{subtitle}</span> : null}
      </span>
    </>
  );

  const cls = `rpg-menu-btn ${tone} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} className={cls} {...rest}>
      {inner}
    </button>
  );
}
