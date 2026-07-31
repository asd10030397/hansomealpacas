/**
 * Phase 10C-3 — attempt-scoped BEER remote trace (diagnostics only).
 * No secrets / RPC keys / auth tokens. Enabled when HANSOME_BEER_TRACE=1
 * or when the token is BEER (always log compact one-liners on Production candidates).
 */

export const BEER_TOKEN = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";

export type BeerRemoteTraceFields = {
  attemptId?: string | null;
  correlationId?: string | null;
  phase?: string;
  positionIndexPath?: string | null;
  tokenId?: string | null;
  ownerOf?: string | null;
  ownerIsPons?: boolean | null;
  adapterId?: string | null;
  getLaunchedTokenExists?: boolean | null;
  positionsCount?: number | null;
  liquidityGt0?: boolean | null;
  positionDiscoveryComplete?: boolean | null;
  lockAnalysisComplete?: boolean | null;
  lockState?: string | null;
  lockerName?: string | null;
  where?: string | null;
  versionTimedOut?: string | null;
  cacheSource?: string | null;
  cacheAgeMs?: number | null;
  semanticVersion?: string | null;
  v3Searched?: boolean | null;
  wallMs?: number | null;
  detail?: string | null;
};

export function isBeerToken(address: string | null | undefined): boolean {
  return Boolean(
    address && address.toLowerCase() === BEER_TOKEN.toLowerCase(),
  );
}

export function beerTraceEnabled(address: string | null | undefined): boolean {
  if (!isBeerToken(address)) return false;
  return (
    process.env.HANSOME_BEER_TRACE === "1" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV !== "test"
  );
}

/** Compact single-line JSON for Vercel logs — never includes credentials. */
export function logBeerRemoteTrace(
  address: string | null | undefined,
  fields: BeerRemoteTraceFields,
): void {
  if (!beerTraceEnabled(address)) return;
  const safe = {
    tag: "BEER_10C3_TRACE",
    token: BEER_TOKEN.slice(0, 10) + "…",
    ...fields,
  };
  // Scrub accidental secret-looking keys (not diagnostic fields like tokenId).
  const allow = new Set([
    "tag",
    "token",
    "tokenId",
    "attemptId",
    "correlationId",
    "phase",
    "positionIndexPath",
    "ownerOf",
    "ownerIsPons",
    "adapterId",
    "getLaunchedTokenExists",
    "positionsCount",
    "liquidityGt0",
    "positionDiscoveryComplete",
    "lockAnalysisComplete",
    "lockState",
    "lockerName",
    "where",
    "versionTimedOut",
    "cacheSource",
    "cacheAgeMs",
    "semanticVersion",
    "v3Searched",
    "wallMs",
    "detail",
  ]);
  for (const k of Object.keys(safe)) {
    if (!allow.has(k)) delete (safe as Record<string, unknown>)[k];
  }
  console.info(JSON.stringify(safe));
}
