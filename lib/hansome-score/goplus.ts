import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";

/**
 * Optional GoPlus Token Security fetch — labeled supplement only.
 * Never silently overrides verified ABI/source conclusions in Score.
 */
export async function fetchGoPlusTokenSecurity(
  tokenAddress: string,
): Promise<Record<string, string | number | boolean | null> | null> {
  try {
    const url = `https://api.gopluslabs.io/api/v1/token_security/${SCAN_CHAIN_ID}?contract_addresses=${tokenAddress}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: Record<string, Record<string, string | number | boolean | null>>;
    };
    const key = tokenAddress.toLowerCase();
    const row = json.result?.[key];
    return row ?? null;
  } catch {
    return null;
  }
}
