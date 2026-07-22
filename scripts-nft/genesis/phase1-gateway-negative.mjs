/**
 * Phase 1 gateway negative test — rotation CID only (abort gate).
 * Tokens 11, 12, 100 on Pinata + ipfs.io.
 */
async function probe(label, url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { Accept: "application/json" },
    });
    clearTimeout(t);
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    const isValidMetadata =
      r.status === 200 &&
      json &&
      typeof json === "object" &&
      (json.name || json.image || json.attributes);
    return {
      label,
      url,
      http: r.status,
      isValidMetadata,
      pass: !(r.status === 200 && isValidMetadata),
      bodyLen: text.length,
    };
  } catch (e) {
    return {
      label,
      url,
      http: "ERR",
      isValidMetadata: false,
      pass: true,
      note: String(e.message || e).slice(0, 120),
    };
  }
}

const rotation =
  process.env.METADATA_CID ||
  "bafybeidehpozq5v32ymq26xm26goy5prao2zduaiidlp4puzw7pmnu7qhi";
const tokens = [11, 12, 100];
const gateways = [
  ["pinata", "https://gateway.pinata.cloud/ipfs"],
  ["ipfs.io", "https://ipfs.io/ipfs"],
];

const targets = [];
for (const id of tokens) {
  for (const [gw, base] of gateways) {
    targets.push([`${gw}-${id}`, `${base}/${rotation}/${id}.json`]);
  }
}

const results = [];
for (const [label, url] of targets) {
  results.push(await probe(label, url));
}

const fails = results.filter((r) => !r.pass);
const pass = fails.length === 0;

console.log(
  JSON.stringify(
    {
      rotationCidFingerprint: `${rotation.slice(0, 7)}…${rotation.slice(-7)}`,
      rotationGatewayNegativePass: pass,
      failCount: fails.length,
      results,
    },
    null,
    2,
  ),
);

process.exit(pass ? 0 : 1);
