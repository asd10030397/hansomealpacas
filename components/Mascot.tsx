"use client";

import type { KeyboardEvent } from "react";
import { m, useReducedMotion } from "framer-motion";
import { ASSETS, PROJECT } from "@/content/project";
import { float } from "@/lib/motion";

type MascotProps = {
  src?: string;
  floating?: boolean;
  className?: string;
  alt?: string;
  interactive?: boolean;
  onClick?: () => void;
};

export function Mascot({
  src = ASSETS.logo,
  floating = false,
  className = "h-64 w-64 sm:h-72 sm:w-72 md:h-80 md:w-80",
  alt = `${PROJECT.name} mascot`,
  interactive = false,
  onClick,
}: MascotProps) {
  const reduceMotion = useReducedMotion();

  const image = (
    <img
      src={src}
      alt={alt}
      className="pointer-events-none object-contain select-none absolute inset-0 h-full w-full"
    />
  );

  const wrapperClass = `relative ${className}${interactive ? " cursor-pointer" : ""}`;

  const handleClick = () => {
    onClick?.();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  if (!floating || reduceMotion) {
    return (
      <div
        className={wrapperClass}
        onClick={interactive ? handleClick : undefined}
        onKeyDown={interactive ? handleKeyDown : undefined}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? alt : undefined}
      >
        {image}
      </div>
    );
  }

  return (
    <m.div
      className={wrapperClass}
      animate={float}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? alt : undefined}
    >
      {image}
    </m.div>
  );
}
