"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  OPT_OUT_COOKIE,
  SESSION_COOKIE,
  VISITOR_COOKIE,
} from "@/lib/website-analytics/constants";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }
  return null;
}

function writeCookie(name: string, value: string, maxAgeSec: number): void {
  try {
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
  } catch {
    /* ignore */
  }
}

function ensureId(cookieName: string, maxAgeSec: number): string {
  const existing = readCookie(cookieName);
  if (
    existing &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      existing,
    )
  ) {
    return existing;
  }
  const id = crypto.randomUUID();
  writeCookie(cookieName, id, maxAgeSec);
  return id;
}

/**
 * Non-blocking first-party pageview beacon.
 * Failures are silent — never blocks rendering.
 */
export function WebsiteAnalyticsBeacon() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (typeof window === "undefined") return;

    // Skip localhost / preview hosts client-side (server also filters).
    const host = window.location.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".vercel.app")
    ) {
      return;
    }

    if (readCookie(OPT_OUT_COOKIE) === "1") return;

    // Debounce identical path in this tab (server also debounces).
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    try {
      const visitorId = ensureId(VISITOR_COOKIE, 90 * 24 * 60 * 60);
      const sessionId = ensureId(SESSION_COOKIE, 30 * 60);
      const payload = JSON.stringify({
        pathname,
        visitorId,
        sessionId,
        referrer: document.referrer || null,
      });

      const url = "/api/analytics/visit";
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        const ok = navigator.sendBeacon(url, blob);
        if (ok) return;
      }

      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        credentials: "same-origin",
      }).catch(() => {
        /* silent */
      });
    } catch {
      /* silent */
    }
  }, [pathname]);

  return null;
}
