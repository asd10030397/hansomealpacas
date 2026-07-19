"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameHref } from "@/hooks/game/useGameHref";

/** Legacy route — Result Phase owns Reveal Move. */
export default function RevealRedirectPage() {
  const router = useRouter();
  const gameHref = useGameHref();

  useEffect(() => {
    router.replace(gameHref.result);
  }, [router, gameHref.result]);

  return null;
}
