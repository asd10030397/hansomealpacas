import Script from "next/script";
import { getAnalyticsConfig, isGaDebugEnabled } from "@/lib/analytics";

export function Analytics() {
  const config = getAnalyticsConfig();

  if (config.provider === "plausible") {
    return (
      <Script
        defer
        data-domain={config.domain}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    );
  }

  if (config.provider === "ga") {
    const debugMode = isGaDebugEnabled();

    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${config.measurementId}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${config.measurementId}', {
              send_page_view: false${debugMode ? ", debug_mode: true" : ""}
            });
          `}
        </Script>
      </>
    );
  }

  return null;
}
