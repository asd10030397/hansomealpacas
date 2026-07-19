/**
 * Fetch sample metadata + images from preferred gateway after pin.
 *
 * Prefers Pinata; retries transient gateway errors; integrity ≠ availability.
 * Does NOT re-pin or regenerate CIDs.
 *
 *   IMAGE_CID=… METADATA_CID=… node scripts-nft/genesis/verify-550-ipfs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchViaGateway,
  parseJsonResult,
  primaryGateway,
  PINATA_GATEWAY,
} from "./lib/ipfs-gateway-fetch.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CID_FILE = path.join(ROOT, "reports/genesis/ipfs-cids.json");
const META_LOCAL = path.join(ROOT, "public/pixel/genesis/collection-550/metadata");
const REPORT = path.join(ROOT, "reports/genesis/ipfs-verify-samples.md");

const SAMPLES = [1, 2, 11, 25, 100, 250, 500, 501, 525, 550];

function loadCids() {
  const fromFile = fs.existsSync(CID_FILE)
    ? JSON.parse(fs.readFileSync(CID_FILE, "utf8"))
    : {};
  return {
    imageCid: process.env.IMAGE_CID || fromFile.imageCid,
    metadataCid: process.env.METADATA_CID || fromFile.metadataCid,
  };
}

async function main() {
  const { imageCid, metadataCid } = loadCids();
  if (!imageCid || !metadataCid) {
    console.error("Need IMAGE_CID and METADATA_CID (env or ipfs-cids.json)");
    process.exit(1);
  }

  const gateway = primaryGateway();
  const lines = [
    "# IPFS sample verification",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `- Image CID: \`${imageCid}\``,
    `- Metadata CID: \`${metadataCid}\``,
    `- Preferred gateway: ${gateway}`,
    `- Pinata gateway: ${PINATA_GATEWAY}`,
    "",
    "| Token | Meta OK | Name | Side | Type | Class | Image OK | Integrity | Availability |",
    "|------:|:-------:|------|------|------|-------|:--------:|-----------|--------------|",
  ];

  let integrityFails = 0;
  let availabilityWarns = 0;
  let metaRetrieved = 0;

  for (const id of SAMPLES) {
    const local = JSON.parse(
      fs.readFileSync(path.join(META_LOCAL, `${id}.json`), "utf8"),
    );
    const integrityNotes = [];
    const availabilityNotes = [];
    let metaOk = false;
    let imgOk = false;
    let remote = null;

    const metaFetch = await fetchViaGateway(gateway, `${metadataCid}/${id}.json`);
    if (!metaFetch.ok) {
      availabilityNotes.push(
        `meta: ${metaFetch.error}${metaFetch.transient ? " (transient)" : ""}`,
      );
      availabilityWarns++;
    } else {
      try {
        remote = parseJsonResult(metaFetch);
        metaOk = true;
        metaRetrieved++;
        if (remote.name !== local.name) {
          integrityNotes.push("name≠local");
          integrityFails++;
        }
        if (remote.image !== `ipfs://${imageCid}/${id}.png`) {
          integrityNotes.push(`image=${remote.image}`);
          integrityFails++;
        }
        if (remote.edition !== id) {
          integrityNotes.push("edition");
          integrityFails++;
        }
      } catch (e) {
        integrityNotes.push(`parse: ${e.message}`);
        integrityFails++;
      }
    }

    const imgFetch = await fetchViaGateway(gateway, `${imageCid}/${id}.png`, {
      maxAttempts: 5,
    });
    if (
      imgFetch.ok &&
      imgFetch.bytes &&
      imgFetch.bytes.length > 100 &&
      imgFetch.bytes[0] === 0x89
    ) {
      imgOk = true;
    } else if (imgFetch.ok) {
      availabilityNotes.push(`img bytes=${imgFetch.bytes?.length ?? 0}`);
      availabilityWarns++;
    } else {
      availabilityNotes.push(`img: ${imgFetch.error}`);
      availabilityWarns++;
    }

    const side =
      remote?.attributes?.find((a) => a.trait_type === "Side")?.value ||
      remote?.hansome?.side ||
      "?";
    const type =
      remote?.attributes?.find((a) => a.trait_type === "Type")?.value ||
      remote?.hansome?.type ||
      "?";
    const cls =
      remote?.attributes?.find((a) => a.trait_type === "Gameplay Class")?.value ||
      remote?.hansome?.gameplayClass ||
      "?";

    lines.push(
      `| ${id} | ${metaOk ? "✓" : "✗"} | ${remote?.name?.slice(0, 40) ?? "—"} | ${side} | ${type} | ${cls} | ${imgOk ? "✓" : "·"} | ${integrityNotes.join("; ") || "ok"} | ${availabilityNotes.join("; ") || "ok"} |`,
    );
  }

  const integrityPass = integrityFails === 0 && metaRetrieved > 0;
  const integrityLabel = integrityPass
    ? "PASS"
    : integrityFails
      ? "FAIL"
      : "UNCONFIRMED";

  lines.push(
    "",
    `## Package integrity: **${integrityLabel}**`,
    "",
    `- Metadata retrieved: ${metaRetrieved}/${SAMPLES.length}`,
    `- Integrity failures: ${integrityFails}`,
    `- Gateway availability warnings: ${availabilityWarns}`,
    "- Transient 502/504 / no-providers retried with exponential backoff.",
    "- Does not re-pin or regenerate CIDs.",
    "",
  );

  const report = lines.join("\n");
  fs.writeFileSync(REPORT, report);
  console.log(report);
  if (!integrityPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
