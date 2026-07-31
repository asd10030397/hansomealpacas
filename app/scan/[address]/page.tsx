import { ScanClient } from "@/components/scan/ScanClient";
import { HANSOME_TOKEN } from "@/lib/hansome-score";
import { peekScanSnapshot } from "@/lib/hansome-score/scan-cache";
import type { ScanResponse } from "@/lib/hansome-score/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  params: Promise<{ address: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { address } = await params;
  return {
    title: `HANSOME Scan — ${address.slice(0, 10)}…`,
    description:
      "Free public-beta on-chain transparency and structural analytics tool for Robinhood Chain.",
  };
}

/**
 * SSR: serve cached snapshot only — never block the page on a cold full scan
 * (LP + creator can take 3–5+ minutes and freeze/time out on Vercel).
 * Client fetches /api/scan when no snapshot is available.
 */
export default async function ScanAddressPage({ params }: Props) {
  const { address: raw } = await params;
  const address = decodeURIComponent(raw || HANSOME_TOKEN);

  let initialResult: ScanResponse | null = null;
  let initialError: string | null = null;
  let initialCacheHit = false;

  try {
    const peeked = await peekScanSnapshot(address);
    if (peeked) {
      initialResult = peeked;
      initialCacheHit = true;
    }
  } catch (err) {
    initialError = err instanceof Error ? err.message : "Scan failed";
  }

  return (
    <ScanClient
      initialAddress={address}
      initialResult={initialResult}
      initialError={initialError}
      autoFetch={!initialCacheHit && !initialError}
    />
  );
}
