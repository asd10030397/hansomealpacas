/**
 * Robinhood Testnet: verify placeholder tokenURI + post-reveal IPFS mapping
 * for Reserved / Public / Legendary / Cougar samples (no re-pin).
 *
 *   npx hardhat run scripts/validate-genesis-testnet-uris.ts --network robinhoodTestnet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

const PINATA = "https://gateway.pinata.cloud/ipfs";
const ROOT = join(__dirname, "..", "..");

type Cids = {
  imageCid: string;
  metadataCid: string;
  placeholderURI: string;
};

async function fetchJson(url: string, attempts = 5): Promise<unknown> {
  let last = "";
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      const text = await res.text();
      if (!res.ok) {
        last = `${res.status} ${text.slice(0, 120)}`;
        if ([502, 503, 504].includes(res.status) || /no providers/i.test(text)) {
          await new Promise((r) => setTimeout(r, 800 * 2 ** (i - 1)));
          continue;
        }
        throw new Error(last);
      }
      return JSON.parse(text);
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
      await new Promise((r) => setTimeout(r, 800 * 2 ** (i - 1)));
    }
  }
  throw new Error(last || "fetch failed");
}

async function main() {
  const cids = JSON.parse(
    readFileSync(join(ROOT, "reports/genesis/ipfs-cids.json"), "utf8"),
  ) as Cids;
  const manifest = JSON.parse(
    readFileSync(join(ROOT, "reports/genesis/reveal-shuffle-manifest.json"), "utf8"),
  ) as {
    tokenIdToPackageIdentityId: Record<string, number>;
    revealSeed: string;
  };

  const genesisPath = join(__dirname, "..", "deployments", `${network.name}-genesis.json`);
  const addr =
    process.env.GENESIS_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_GENESIS_NFT_ADDRESS ||
    (JSON.parse(readFileSync(genesisPath, "utf8")) as { address: string }).address;

  const signer = await getDeployerSigner(ethers.provider);
  const nft = await ethers.getContractAt("HansomeGenesisNFT", addr, signer);

  const revealed = await nft.collectionRevealed();
  const totalMinted = Number(await nft.totalMinted());
  const expectedPlaceholder = cids.placeholderURI;
  const expectedBase = `ipfs://${cids.metadataCid}/`;

  // Stratified token samples by category (may not all be minted yet)
  const samples: { id: number; category: string }[] = [
    { id: 1, category: "Reserved/Founder" },
    { id: 2, category: "Reserved/Legendary" },
    { id: 8, category: "Reserved/Legendary" },
    { id: 10, category: "Reserved" },
    { id: 11, category: "Public/sale" },
    { id: 12, category: "Public/sale" },
  ];

  // Add highest minted sale ids if present
  for (let id = Math.max(11, totalMinted - 2); id <= totalMinted; id++) {
    if (!samples.some((s) => s.id === id)) {
      samples.push({ id, category: "Public/sale" });
    }
  }

  const rows: Record<string, unknown>[] = [];
  let uriOk = 0;
  let metaOk = 0;
  let imgOk = 0;
  let ownedOk = 0;

  for (const { id, category } of samples) {
    const row: Record<string, unknown> = { id, category };
    try {
      const owner = await nft.ownerOf(id);
      row.owner = owner;
      row.ownedByDeployer = owner.toLowerCase() === signer.address.toLowerCase();
      if (row.ownedByDeployer) ownedOk++;

      const uri = await nft.tokenURI(id);
      row.tokenURI = uri;
      if (!revealed) {
        row.tokenURIMatchesPlaceholder = uri === expectedPlaceholder;
        if (row.tokenURIMatchesPlaceholder) uriOk++;
      } else {
        row.tokenURIMatchesReveal = uri === `${expectedBase}${id}.json`;
        if (row.tokenURIMatchesReveal) uriOk++;
      }

      // Off-chain reveal package (always check — this is the post-reveal mapping)
      const identity =
        id <= 10 ? id : manifest.tokenIdToPackageIdentityId[String(id)];
      row.packageIdentityId = identity;
      const metaUrl = `${PINATA}/${cids.metadataCid}/${id}.json`;
      const meta = (await fetchJson(metaUrl)) as {
        name?: string;
        image?: string;
        edition?: number;
        hansome?: { packageIdentityId?: number; side?: string; gameplayClass?: string };
        attributes?: { trait_type: string; value: string }[];
      };
      row.metaName = meta.name;
      row.metaSide =
        meta.hansome?.side ||
        meta.attributes?.find((a) => a.trait_type === "Side")?.value;
      row.metaClass =
        meta.hansome?.gameplayClass ||
        meta.attributes?.find((a) => a.trait_type === "Gameplay Class")?.value;
      const identityMatch = meta.hansome?.packageIdentityId === identity;
      const imageMatch = meta.image === `ipfs://${cids.imageCid}/${identity}.png`;
      row.revealMappingOk = identityMatch && imageMatch && meta.edition === id;
      if (row.revealMappingOk) metaOk++;

      const imgRes = await fetch(
        `${PINATA}/${cids.imageCid}/${identity}.png`,
        { redirect: "follow" },
      );
      row.artworkOk = imgRes.ok && Number(imgRes.headers.get("content-length") || 0) > 1000;
      if (!row.artworkOk && imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        row.artworkOk = buf.length > 1000 && buf[0] === 0x89;
      }
      if (row.artworkOk) imgOk++;
    } catch (e) {
      row.error = e instanceof Error ? e.message.slice(0, 160) : String(e);
    }
    rows.push(row);
  }

  // Legendary / Cougar samples from baked package (may be unminted — IPFS only)
  const packageSamples = [
    { id: 1, label: "Founder King" },
    { id: 2, label: "Reserved Guardian" },
    { id: 11, label: "First sale (shuffled)" },
    { id: 501, label: "Sale #501 (mapped identity)" },
    { id: 525, label: "Sale #525" },
    { id: 550, label: "Last sale" },
  ];
  const packageRows = [];
  for (const s of packageSamples) {
    const meta = (await fetchJson(
      `${PINATA}/${cids.metadataCid}/${s.id}.json`,
    )) as {
      name?: string;
      hansome?: { packageIdentityId?: number; side?: string; gameplayClass?: string };
      attributes?: { trait_type: string; value: string }[];
    };
    packageRows.push({
      ...s,
      side:
        meta.hansome?.side ||
        meta.attributes?.find((a) => a.trait_type === "Side")?.value,
      class:
        meta.hansome?.gameplayClass ||
        meta.attributes?.find((a) => a.trait_type === "Gameplay Class")?.value,
      identity: meta.hansome?.packageIdentityId,
      name: meta.name,
    });
  }

  const report = {
    network: network.name,
    generatedAt: new Date().toISOString(),
    genesis: addr,
    collectionRevealed: revealed,
    totalMinted,
    expectedPlaceholder,
    expectedBaseURI: expectedBase,
    note: revealed
      ? "Collection revealed — tokenURI returns baseURI+id.json"
      : "Pre-reveal: on-chain tokenURI MUST equal placeholder; reveal mapping verified via Pinata metadata package",
    onChainSamples: rows,
    packageCategorySamples: packageRows,
    summary: {
      tokenUriChecksPassed: uriOk,
      revealMappingPassed: metaOk,
      artworkPassed: imgOk,
      ownedByDeployer: ownedOk,
      sampleCount: samples.length,
    },
  };

  const outDir = join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, `${network.name}-uri-validation.json`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    `# Genesis URI validation — ${network.name}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Genesis: \`${addr}\``,
    `- collectionRevealed: **${revealed}**`,
    `- totalMinted: **${totalMinted}**`,
    `- Placeholder: \`${expectedPlaceholder}\``,
    `- Base URI: \`${expectedBase}\``,
    "",
    `## Summary`,
    "",
    `- tokenURI checks: ${uriOk}/${samples.length}`,
    `- Reveal mapping (Pinata): ${metaOk}/${samples.length}`,
    `- Artwork (Pinata): ${imgOk}/${samples.length}`,
    `- Owned by deployer: ${ownedOk}`,
    "",
    report.note,
    "",
    `Full JSON: \`${jsonPath}\``,
    "",
  ].join("\n");
  const mdPath = join(ROOT, "reports/genesis/robinhood-testnet-uri-validation.md");
  mkdirSync(join(ROOT, "reports/genesis"), { recursive: true });
  writeFileSync(mdPath, md);

  console.log(md);
  console.log(JSON.stringify(report.summary, null, 2));

  if (uriOk < samples.filter((s) => s.id <= totalMinted).length) {
    process.exitCode = 1;
  }
  if (metaOk < samples.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
