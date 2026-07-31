"use client";

import { useEffect, useState } from "react";
import { OPT_OUT_COOKIE } from "@/lib/website-analytics/constants";

function readOptOut(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim() === `${OPT_OUT_COOKIE}=1`);
}

export function PrivacyOptOut() {
  const [optedOut, setOptedOut] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOptedOut(readOptOut());
  }, []);

  async function setOptOut(next: boolean) {
    setBusy(true);
    try {
      await fetch("/api/analytics/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optOut: next }),
        credentials: "same-origin",
      });
      setOptedOut(next);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gold-border mt-4 rounded-2xl p-5">
      <p className="text-sm text-foreground">
        Status:{" "}
        <span className="text-gold-light">
          {optedOut ? "Opted out" : "Analytics enabled for this browser"}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || optedOut}
          onClick={() => void setOptOut(true)}
          className="rounded-lg bg-gold/90 px-4 py-2 text-sm text-background disabled:opacity-40"
        >
          Opt out
        </button>
        <button
          type="button"
          disabled={busy || !optedOut}
          onClick={() => void setOptOut(false)}
          className="rounded-lg border border-gold/40 px-4 py-2 text-sm text-gold-light disabled:opacity-40"
        >
          Opt back in
        </button>
      </div>
    </div>
  );
}
