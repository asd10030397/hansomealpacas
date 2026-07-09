"use client";

import { useEffect } from "react";
import { mountAmbientSound } from "@/lib/ambient-sound";

export function AmbientSound() {
  useEffect(() => mountAmbientSound(), []);
  return null;
}
