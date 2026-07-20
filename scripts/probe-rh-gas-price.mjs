/**
 * Probe eth_gasPrice on Robinhood RPC endpoints.
 */
import { readFileSync } from "node:fs";

const env = (() => {
  try {
    return readFileSync(new URL("../contracts/.env", import.meta.url), "utf8");
  } catch {
    return "";
  }
})();

const fromEnv = [...env.matchAll(/https?:\/\/[^\s"'\\]+/g)].map((m) => m[0]);
const candidates = [
  ...fromEnv,
  "https://rpc.robinhood.com",
  "https://mainnet.robinhoodchain.com",
  "https://rpc.mainnet.robinhood.com",
  "https://api.mainnet.robinhood.com",
];

const uniq = [...new Set(candidates)];

for (const url of uniq) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_gasPrice",
        params: [],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    if (j.result) {
      const wei = BigInt(j.result);
      console.log(
        JSON.stringify({
          url,
          wei: j.result,
          gwei: Number(wei) / 1e9,
        }),
      );
    } else {
      console.log(JSON.stringify({ url, error: j.error ?? j }));
    }
  } catch (e) {
    console.log(JSON.stringify({ url, error: String(e.message || e).slice(0, 120) }));
  }
}
