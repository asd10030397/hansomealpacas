"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { PROJECT } from "@/content/project";

type EasterEggOverlayProps = {
  active: boolean;
  fadeMs: number;
};

export function EasterEggOverlay({ active, fadeMs }: EasterEggOverlayProps) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : fadeMs / 1000;

  return (
    <AnimatePresence>
      {active && (
        <m.div
          role="status"
          aria-live="polite"
          aria-label={PROJECT.taglineCN}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
        >
          <p className="text-center text-2xl text-foreground sm:text-3xl md:text-4xl">
            {PROJECT.taglineCN}
          </p>
        </m.div>
      )}
    </AnimatePresence>
  );
}
