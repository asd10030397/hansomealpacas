"use client";

import { useEffect } from "react";
import {
  installTutorialCaptureStyles,
  isTutorialCapture,
  seedTutorialCapture,
  getTutorialPhaseOverride,
} from "@/lib/game/tutorialCapture";

/**
 * When ?capture=1, hide promo chrome and ensure tutorial seed matches phase.
 */
export function TutorialCaptureInit() {
  useEffect(() => {
    if (!isTutorialCapture()) return;
    installTutorialCaptureStyles();
    const phase = getTutorialPhaseOverride() ?? "COMMIT";
    seedTutorialCapture(phase);
  }, []);

  return null;
}
