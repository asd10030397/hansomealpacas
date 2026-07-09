export type AnalyticsProvider = "plausible" | "ga" | "none";

export type AnalyticsConfig =
  | { provider: "none" }
  | { provider: "plausible"; domain: string }
  | { provider: "ga"; measurementId: string };

export function getAnalyticsConfig(): AnalyticsConfig {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  if (plausibleDomain) {
    return { provider: "plausible", domain: plausibleDomain };
  }

  const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim();
  if (gaId) {
    return { provider: "ga", measurementId: gaId };
  }

  return { provider: "none" };
}

export function trackEvent(name: string, props?: Record<string, string>): void {
  if (typeof window === "undefined") return;

  const config = getAnalyticsConfig();

  if (config.provider === "plausible" && "plausible" in window) {
    const plausible = (
      window as Window & {
        plausible: (event: string, options?: { props: Record<string, string> }) => void;
      }
    ).plausible;
    if (props) {
      plausible(name, { props });
    } else {
      plausible(name);
    }
    return;
  }

  if (config.provider === "ga" && "gtag" in window) {
    (window as Window & { gtag: (...args: unknown[]) => void }).gtag("event", name, props);
  }
}
