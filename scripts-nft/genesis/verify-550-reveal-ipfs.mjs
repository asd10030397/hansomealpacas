/**
 * Gateway-verify shuffled reveal metadata + identity images.
 *
 * Prefers Pinata gateway. Retries transient 502/504 / "no providers".
 * Distinguishes package integrity (Pinata metadata) from gateway availability.
 * Does NOT pin, bake, or regenerate CIDs — reads reports/genesis/ipfs-cids.json.
 *
 *   IMAGE_CID=… METADATA_CID=… node scripts-nft/genesis/verify-550-reveal-ipfs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchViaGateway,
  parseJsonResult,
  primaryGateway,
  PUBLIC_GATEWAY,
  PINATA_GATEWAY,
} from "./lib/ipfs-gateway-fetch.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CID_FILE = path.join(ROOT, "reports/genesis/ipfs-cids.json");
const MANIFEST = path.join(ROOT, "reports/genesis/reveal-shuffle-manifest.json");
const REPORT = path.join(ROOT, "reports/genesis/ipfs-verify-reveal.md");

function load() {
  const cids = fs.existsSync(CID_FILE)
    ? JSON.parse(fs.readFileSync(CID_FILE, "utf8"))
    : {};
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  return {
    imageCid: process.env.IMAGE_CID || cids.imageCid || manifest.imageCid,
    metadataCid: process.env.METADATA_CID || cids.metadataCid,
    manifest,
    cids,
  };
}

async function main() {
  const { imageCid, metadataCid, manifest } = load();
  if (!imageCid || !metadataCid) throw new Error("Need IMAGE_CID and METADATA_CID");

  const gateway = primaryGateway();
  const samples = [1, 2, 8, 10, 11, 13, 100, 250, 500, 501, 525, 550];

  /** @type {{ id: number, metaOk: boolean, imgOk: boolean, integrityNotes: string[], availabilityNotes: string[], remote: any, attempts: number }[]} */
  const rows = [];

  let integrityFails = 0;
  let availabilityWarns = 0;

  for (const id of samples) {
    const integrityNotes = [];
    const availabilityNotes = [];
    let metaOk = false;
    let imgOk = false;
    let remote = null;
    let attempts = 0;

    const metaFetch = await fetchViaGateway(gateway, `${metadataCid}/${id}.json`);
    attempts = metaFetch.attempts;

    if (!metaFetch.ok) {
      // Exhausted retries → gateway/propagation, not package corruption
      availabilityNotes.push(
        `meta gateway: ${metaFetch.error} (${attempts} attempts${metaFetch.transient ? ", transient" : ""})`,
      );
      availabilityWarns++;
    } else {
      try {
        remote = parseJsonResult(metaFetch);
        metaOk = true;
        const identity = remote.hansome?.packageIdentityId;
        const expect =
          id <= 10 ? id : manifest.tokenIdToPackageIdentityId[String(id)];
        if (identity !== expect) {
          integrityNotes.push(`identity want ${expect} got ${identity}`);
          integrityFails++;
        }
        if (remote.image !== `ipfs://${imageCid}/${identity}.png`) {
          integrityNotes.push(`image field ${remote.image}`);
          integrityFails++;
        }
        if (remote.edition !== id) {
          integrityNotes.push("edition");
          integrityFails++;
        }

        // Image via same preferred gateway (Pinata) — soft failure = availability
        const imgFetch = await fetchViaGateway(
          gateway,
          `${imageCid}/${identity}.png`,
          { maxAttempts: 5 },
        );
        attempts += imgFetch.attempts;
        if (
          imgFetch.ok &&
          imgFetch.bytes &&
          imgFetch.bytes.length > 1000 &&
          imgFetch.bytes[0] === 0x89
        ) {
          imgOk = true;
        } else if (imgFetch.ok) {
          availabilityNotes.push(`img bytes=${imgFetch.bytes?.length ?? 0}`);
          availabilityWarns++;
        } else {
          availabilityNotes.push(
            `img gateway: ${imgFetch.error} (${imgFetch.attempts} attempts)`,
          );
          availabilityWarns++;
        }
      } catch (e) {
        integrityNotes.push(`meta parse: ${e.message}`);
        integrityFails++;
      }
    }

    rows.push({
      id,
      metaOk,
      imgOk,
      integrityNotes,
      availabilityNotes,
      remote,
      attempts,
    });
  }

  // Integrity: content of successfully retrieved Pinata metadata.
  // Gateway/propagation exhaustion is availability only (does not FAIL integrity).
  const metaRetrieved = rows.filter((r) => r.metaOk).length;
  const contentMismatches = rows.reduce(
    (n, r) => n + r.integrityNotes.length,
    0,
  );
  let packageIntegrity;
  if (metaRetrieved === 0) {
    packageIntegrity = "UNCONFIRMED"; // could not reach Pinata at all
  } else if (contentMismatches === 0 && integrityFails === 0) {
    packageIntegrity = "PASS";
  } else {
    packageIntegrity = "FAIL";
  }

  // Optional public-gateway smoke (does not affect integrity exit)
  let publicMetaOk = 0;
  if (gateway !== PUBLIC_GATEWAY && process.env.SKIP_PUBLIC_GATEWAY !== "1") {
    for (const id of [1, 100, 550]) {
      const r = await fetchViaGateway(PUBLIC_GATEWAY, `${metadataCid}/${id}.json`, {
        maxAttempts: 3,
        baseDelayMs: 1000,
      });
      if (r.ok) publicMetaOk++;
    }
  }

  const lines = [
    "# IPFS reveal package verification",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Verdict",
    "",
    `| Check | Result |`,
    `|-------|--------|`,
    `| **Package integrity** (Pinata / preferred gateway metadata) | **${packageIntegrity}** |`,
    `| Metadata retrieved | ${metaRetrieved}/${samples.length} |`,
    `| Integrity content failures | ${integrityFails} |`,
    `| Gateway availability warnings | ${availabilityWarns} |`,
    `| Public gateway smoke (ipfs.io, informational) | ${publicMetaOk}/3 |`,
    "",
    "## CIDs (unchanged — verify only)",
    "",
    `- Image CID: \`${imageCid}\``,
    `- Metadata CID: \`${metadataCid}\``,
    `- Preferred gateway: ${gateway}`,
    `- Pinata gateway: ${PINATA_GATEWAY}`,
    `- Reveal seed: \`${manifest.revealSeed}\``,
    "",
    "## Notes",
    "",
    "- Integrity is determined by successful metadata retrieval + field checks on the preferred (Pinata) gateway.",
    "- Transient 502/504 / “no providers found” are retried with exponential backoff.",
    "- Image or public-gateway timeouts are **availability** warnings, not package corruption.",
    "- This script does not re-pin or regenerate CIDs.",
    "",
    "| Token | Meta | Name | Side | Class | Identity | Image | Integrity | Availability |",
    "|------:|:----:|------|------|-------|---------:|:-----:|-----------|--------------|",
  ];

  for (const r of rows) {
    const side =
      r.remote?.attributes?.find((a) => a.trait_type === "Side")?.value || "?";
    const cls =
      r.remote?.attributes?.find((a) => a.trait_type === "Gameplay Class")
        ?.value ||
      r.remote?.hansome?.gameplayClass ||
      "?";
    const identity = r.remote?.hansome?.packageIdentityId ?? "?";
    lines.push(
      `| ${r.id} | ${r.metaOk ? "✓" : "✗"} | ${(r.remote?.name || "—").slice(0, 36)} | ${side} | ${cls} | ${identity} | ${r.imgOk ? "✓" : "·"} | ${r.integrityNotes.join("; ") || "ok"} | ${r.availabilityNotes.join("; ") || "ok"} |`,
    );
  }

  lines.push(
    "",
    `## Result: **${packageIntegrity}** (integrity) · availability warnings: ${availabilityWarns}`,
    "",
  );

  const report = lines.join("\n");
  fs.writeFileSync(REPORT, report);
  console.log(report);

  // Exit 0 when Pinata metadata integrity passes; availability warnings are non-fatal.
  // Exit 1 only on content FAIL or total inability to retrieve any metadata.
  if (packageIntegrity !== "PASS") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
