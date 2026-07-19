/**
 * Resilient IPFS gateway fetch for verification (not pin/upload).
 * Prefers Pinata; retries transient 502/504 and "no providers" with backoff.
 */

export const PINATA_GATEWAY =
  process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs";

export const PUBLIC_GATEWAY =
  process.env.IPFS_PUBLIC_GATEWAY || "https://ipfs.io/ipfs";

/** Preferred verify gateway (Pinata first). Override with IPFS_GATEWAY. */
export function primaryGateway() {
  return process.env.IPFS_GATEWAY || PINATA_GATEWAY;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string} text
 * @param {number} status
 */
export function isTransientGatewayFailure(status, text) {
  if (status === 502 || status === 503 || status === 504) return true;
  if (status === 408 || status === 429) return true;
  const t = (text || "").toLowerCase();
  if (t.includes("no providers found")) return true;
  if (t.includes("timeout")) return true;
  if (t.includes("unable to retrieve content")) return true;
  if (t.includes("gateway time-out")) return true;
  if (t.includes("bad gateway")) return true;
  return false;
}

/**
 * @typedef {{ ok: boolean, status: number, text: string, bytes?: Buffer, attempts: number, gateway: string, transient?: boolean, error?: string }} GatewayFetchResult
 */

/**
 * GET with retries for transient gateway / propagation errors.
 *
 * @param {string} gatewayBase e.g. https://gateway.pinata.cloud/ipfs
 * @param {string} cidPath e.g. `${cid}/1.json`
 * @param {{ maxAttempts?: number, baseDelayMs?: number, timeoutMs?: number }} [opts]
 * @returns {Promise<GatewayFetchResult>}
 */
export async function fetchViaGateway(gatewayBase, cidPath, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 6;
  const baseDelayMs = opts.baseDelayMs ?? 800;
  const timeoutMs = opts.timeoutMs ?? 45000;
  const base = gatewayBase.replace(/\/$/, "");
  const url = `${base}/${cidPath.replace(/^\//, "")}`;

  let last = {
    ok: false,
    status: 0,
    text: "",
    attempts: 0,
    gateway: base,
    transient: false,
    error: "not attempted",
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last.attempts = attempt;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        redirect: "follow",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const buf = Buffer.from(await res.arrayBuffer());
      const text = buf.toString("utf8");
      last = {
        ok: res.ok,
        status: res.status,
        text,
        bytes: buf,
        attempts: attempt,
        gateway: base,
        transient: !res.ok && isTransientGatewayFailure(res.status, text),
        error: res.ok ? undefined : `${res.status} ${text.slice(0, 160)}`,
      };
      if (res.ok) return last;
      if (!last.transient || attempt === maxAttempts) return last;
    } catch (e) {
      const msg = e?.name === "AbortError" ? "timeout" : e?.message || String(e);
      last = {
        ok: false,
        status: 0,
        text: "",
        attempts: attempt,
        gateway: base,
        transient: true,
        error: msg,
      };
      if (attempt === maxAttempts) return last;
    }
    // Exponential backoff: 800, 1600, 3200, … capped
    const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), 12000);
    await sleep(delay);
  }
  return last;
}

/**
 * @param {GatewayFetchResult} result
 */
export function parseJsonResult(result) {
  if (!result.ok) throw new Error(result.error || `HTTP ${result.status}`);
  try {
    return JSON.parse(result.text);
  } catch {
    throw new Error("invalid JSON body");
  }
}
