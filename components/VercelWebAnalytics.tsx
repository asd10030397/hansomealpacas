import { Analytics } from "@vercel/analytics/next";

/**
 * Official Vercel Web Analytics (App Router) — pageviews for Vercel dashboard.
 * Enable "Web Analytics" on the Vercel project; no custom env var required.
 * Complements optional Plausible/GA in {@link Analytics}.
 */
export function VercelWebAnalytics() {
  return <Analytics />;
}
