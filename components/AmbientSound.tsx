"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { mountAmbientSound } from "@/lib/ambient-sound";

export function AmbientSound() {
  const pathname = usePathname();
  const isGame = pathname === "/game" || pathname.startsWith("/game/");

  useEffect(() => {
    if (isGame) return;
    return mountAmbientSound();
  }, [isGame]);

  return null;
}
