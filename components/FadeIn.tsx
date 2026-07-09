"use client";

import { m, useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";
import { EASE } from "@/lib/motion";

type FadeInProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "section" | "div" | "article";
  id?: string;
};

export function FadeIn({
  children,
  className,
  delay = 0,
  as = "div",
  id,
}: FadeInProps) {
  const reduceMotion = useReducedMotion();
  const Component = m[as];

  return (
    <Component
      id={id}
      className={className}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{
        duration: reduceMotion ? 0 : 0.7,
        ease: EASE,
        delay: reduceMotion ? 0 : delay,
      }}
    >
      {children}
    </Component>
  );
}
