import Link from "next/link";
import type { Metadata } from "next";
import { PrivacyOptOut } from "@/components/PrivacyOptOut";
import { FooterSection } from "@/sections/FooterSection";
import { PROJECT } from "@/content/project";

export const metadata: Metadata = {
  title: "Privacy | HANSOME ALPACAS",
  description:
    "How HANSOME ALPACAS handles website analytics, cookies, and privacy.",
};

export default function PrivacyPage() {
  return (
    <>
      <main
        id="main-content"
        className="relative min-h-screen overflow-x-hidden px-6 pb-12 pt-16"
      >
        <div aria-hidden="true" className="gold-glow-bg pointer-events-none absolute inset-0" />

        <article className="relative z-10 mx-auto flex w-full max-w-3xl flex-col py-12 text-left">
          <Link
            href="/"
            className="mb-10 self-start font-[family-name:var(--font-anton)] text-xs tracking-[0.28em] text-muted transition-colors hover:text-gold-light"
          >
            ← HOME
          </Link>

          <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.4em] text-gold-light">
            PRIVACY
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-anton)] text-[clamp(1.75rem,6vw,3rem)] tracking-[0.08em] text-foreground">
            WEBSITE ANALYTICS
          </h1>

          <div className="mt-8 space-y-5 text-base leading-relaxed text-muted">
            <p>
              {PROJECT.name} uses first-party, privacy-minimal website analytics to
              understand aggregate traffic (page views, estimated unique visitors, and
              unique network addresses). This is separate from HANSOME Scan scoring and
              does not affect token scores.
            </p>

            <h2 className="pt-2 font-[family-name:var(--font-anton)] text-sm tracking-[0.2em] text-foreground">
              WHAT WE COLLECT
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Page path and approximate referrer host (aggregated).</li>
              <li>
                A random anonymous visitor ID in a first-party cookie (
                <code className="text-gold-light">ha_vid</code>), rotated after about 90
                days.
              </li>
              <li>
                A short-lived session ID (
                <code className="text-gold-light">ha_sid</code>, ~30 minutes).
              </li>
              <li>
                A privacy-preserving hash of your IP address (HMAC with a server secret).{" "}
                <strong className="font-medium text-foreground">
                  We never store raw IP addresses
                </strong>{" "}
                in analytics storage.
              </li>
              <li>
                Country code only when our hosting platform (Vercel) already provides a
                trusted edge header — never precise GPS or street-level location.
              </li>
            </ul>

            <h2 className="pt-2 font-[family-name:var(--font-anton)] text-sm tracking-[0.2em] text-foreground">
              WHAT WE DO NOT COLLECT
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>No wallet addresses as visitor identity.</li>
              <li>No device fingerprinting beyond a random cookie ID.</li>
              <li>No individual browsing history dashboards for the public.</li>
              <li>No sale of personal data.</li>
            </ul>

            <h2 className="pt-2 font-[family-name:var(--font-anton)] text-sm tracking-[0.2em] text-foreground">
              RETENTION
            </h2>
            <p>
              Daily deduplication keys expire in about 48 hours. Anonymous visitor
              dedupe keys are retained up to ~100 days (aligned with the cookie).
              IP-hash all-time dedupe keys are retained up to ~400 days. Aggregate
              counters (totals, daily buckets) may be kept longer for operations.
              Bot-excluded request counts are stored as aggregates only.
            </p>

            <h2 className="pt-2 font-[family-name:var(--font-anton)] text-sm tracking-[0.2em] text-foreground">
              ESTIMATED UNIQUES
            </h2>
            <p>
              Unique visitors and unique IPs are <em>estimates</em>. Many people can
              share one network address (offices, mobile carriers, VPNs), and one person
              can appear under many addresses. Figures are for traffic trends, not a
              census of people.
            </p>

            <h2 className="pt-2 font-[family-name:var(--font-anton)] text-sm tracking-[0.2em] text-foreground">
              OPT OUT
            </h2>
            <p>
              You can opt out of first-party website analytics on this browser. We set a
              preference cookie so future page views from this browser are not counted.
              (Third-party tools such as Vercel Web Analytics, if enabled on the
              project, follow their own controls.)
            </p>

            <PrivacyOptOut />

            <p className="pt-4 text-sm">
              Questions about this notice: use the official social channels linked in the
              site footer. This page describes website analytics only — not on-chain
              public data.
            </p>
          </div>
        </article>
      </main>
      <FooterSection />
    </>
  );
}
