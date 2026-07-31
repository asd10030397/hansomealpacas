import { BOT_UA_PATTERNS } from "@/lib/website-analytics/constants";

export type ExcludeReason =
  | "bot"
  | "preview"
  | "localhost"
  | "opt_out"
  | "api"
  | "asset"
  | "internal"
  | "empty_path"
  | "disabled";

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || !ua.trim()) return true; // empty UA treated as non-browser
  const lower = ua.toLowerCase();
  return BOT_UA_PATTERNS.some((p) => lower.includes(p));
}

export function isPreviewDeployment(
  env: NodeJS.ProcessEnv = process.env,
  host?: string | null,
): boolean {
  if (env.VERCEL_ENV === "preview") return true;
  if (env.ANALYTICS_FORCE_PREVIEW === "1") return true;
  const h = (host || "").toLowerCase();
  if (h.endsWith(".vercel.app")) return true;
  return false;
}

export function isLocalhostHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local")
  );
}

/** Normalize pathname for counters; null if should not count. */
export function normalizePathname(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let path = raw.trim();
  if (!path) return null;
  if (!path.startsWith("/")) path = `/${path}`;
  // Strip query/hash if accidentally included
  path = path.split("?")[0]!.split("#")[0]!;
  // Collapse multiple slashes
  path = path.replace(/\/+/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  if (
    path.startsWith("/api") ||
    path.startsWith("/_next") ||
    path.startsWith("/.") ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/manifest.webmanifest"
  ) {
    return null;
  }

  // Static assets / files with extensions (except known HTML-like public pages)
  const last = path.split("/").pop() ?? "";
  if (last.includes(".")) {
    const ext = last.split(".").pop()?.toLowerCase();
    const allow = new Set(["html", "htm"]);
    if (ext && !allow.has(ext)) return null;
  }

  // Cap length to avoid key abuse
  if (path.length > 200) path = path.slice(0, 200);
  return path;
}

export function normalizeReferrer(
  raw: string | null | undefined,
  selfHosts: string[] = [
    "hansomealpacas.xyz",
    "www.hansomealpacas.xyz",
    "game.hansomealpacas.xyz",
  ],
): string | null {
  if (!raw || !raw.trim()) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (selfHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return null; // internal navigation
    }
    if (host === "localhost" || host === "127.0.0.1") return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

export function classifyExclusion(input: {
  userAgent?: string | null;
  host?: string | null;
  pathname?: string | null;
  optOut?: boolean;
  env?: NodeJS.ProcessEnv;
}): ExcludeReason | null {
  const env = input.env ?? process.env;
  if (env.ANALYTICS_DISABLED === "1") return "disabled";
  if (input.optOut) return "opt_out";
  if (isPreviewDeployment(env, input.host)) return "preview";
  if (isLocalhostHost(input.host)) return "localhost";
  if (isBotUserAgent(input.userAgent)) return "bot";

  const path = input.pathname?.trim() ?? "";
  if (!path) return "empty_path";
  if (path.startsWith("/api")) return "api";
  if (path.startsWith("/_next")) return "internal";
  if (normalizePathname(path) === null) {
    if (path.includes(".")) return "asset";
    return "internal";
  }
  return null;
}
