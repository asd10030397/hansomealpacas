"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameHref } from "@/hooks/game/useGameHref";

/** Legacy route — Result Phase owns settlement + battle results. */
export default function SettlementRedirectPage() {
  const router = useRouter();
  const gameHref = useGameHref();

  useEffect(() => {
    router.replace(gameHref.result);
  }, [router, gameHref.result]);

  return null;
}
