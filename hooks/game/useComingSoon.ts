"use client";

import { useCallback, useState } from "react";

/** Shared open/close state for ComingSoonModal when not using ComingSoonButton. */
export function useComingSoon(initialFeature = "") {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState(initialFeature);

  const showComingSoon = useCallback((nextFeature?: string) => {
    if (nextFeature) setFeature(nextFeature);
    setOpen(true);
  }, []);

  const closeComingSoon = useCallback(() => setOpen(false), []);

  return { open, feature, showComingSoon, closeComingSoon };
}
