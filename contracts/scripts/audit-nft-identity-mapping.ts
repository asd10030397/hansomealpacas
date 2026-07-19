/**
 * Audit tokenId → metadata → image → species → class mapping (Testnet QA).
 * Usage: npx hardhat run scripts/audit-nft-identity-mapping.ts --network robinhoodTestnet
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { readFileSync } from "node:fs";

const TOKENS = [1, 11, 12, 13, 14, 15, 16, 29];

const CLASS = ["None", "Common", "Guardian", "Farmer", "Lucky", "Runner", "King"];

async function fetchMeta(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    return (await res.json()) as {
      image?: string;
      attributes?: Array<{ trait_type?: string; value?: string }>;
    };
  } catch {
    return null;
  }
}

async function main() {
  const record = JSON.parse(
    readFileSync(join(__dirname, "..", "deployments", `${network.name}-game.json`), "utf8"),
  ) as { genesis: string };
  const assigned = JSON.parse(
    readFileSync(
      join(__dirname, "..", "..", "lib", "game", "data", "testnetAssigned540.json"),
      "utf8",
    ),
  ) as { assigned: number[]; revealSeed: string };

  const genesis = await ethers.getContractAt("HansomeGenesisNFT", record.genesis);
  const cid =
    process.env.NEXT_PUBLIC_GENESIS_METADATA_CID?.trim() ||
    "bafybeihs7d6nzeq2s6woads3bsbpwa5g4fgspz7fmtxr4wd6xh2idd224e";
  const gateway =
    process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim() || "https://gateway.pinata.cloud/ipfs/";

  const rows = [];
  const bugs: string[] = [];

  for (const tokenId of TOKENS) {
    const revealed = await genesis.isRevealed(tokenId);
    let onChainSide = "Unknown";
    let onChainClass = "None";
    if (revealed) {
      const sideN = Number(await genesis.side(tokenId));
      const clsN = Number(await genesis.gameplayClass(tokenId));
      onChainSide = sideN === 1 ? "Alpaca" : sideN === 2 ? "Cougar" : "Unknown";
      onChainClass = CLASS[clsN] ?? "None";
    }

    let deckSide: string | null = null;
    let deckClass: string | null = null;
    if (tokenId >= 11 && tokenId <= 550) {
      const packed = assigned.assigned[tokenId - 11]!;
      const isCougar = (packed & 0x80) !== 0;
      const cls = packed & 0x0f;
      deckSide = isCougar ? "Cougar" : "Alpaca";
      deckClass = isCougar ? "None" : (CLASS[cls] ?? "Common");
    }

    const metaUrl = `${gateway.replace(/\/$/, "")}/${cid}/${tokenId}.json`;
    const meta = await fetchMeta(metaUrl);
    let metaSide = "Unknown";
    let metaClass = "None";
    let image = meta?.image ?? "";
    for (const a of meta?.attributes ?? []) {
      const k = String(a.trait_type ?? "").toLowerCase();
      const v = String(a.value ?? "");
      if (k === "side") {
        if (/alpaca/i.test(v)) metaSide = "Alpaca";
        else if (/cougar/i.test(v)) metaSide = "Cougar";
      }
      if (k === "gameplay class" || k === "class") {
        const hit = CLASS.find((c) => c.toLowerCase() === v.toLowerCase().split(" ")[0]);
        if (hit) metaClass = hit;
        else if (/king/i.test(v)) metaClass = "King";
        else if (/lucky/i.test(v)) metaClass = "Lucky";
        else if (/guardian/i.test(v)) metaClass = "Guardian";
        else if (/farmer/i.test(v)) metaClass = "Farmer";
        else if (/runner/i.test(v)) metaClass = "Runner";
        else if (/common/i.test(v)) metaClass = "Common";
      }
    }

    // Settlement identity priority on Testnet (UI): revealed → deck → meta
    const settleSide = revealed ? onChainSide : deckSide ?? metaSide;
    const settleClass = revealed
      ? onChainClass
      : deckSide === "Cougar"
        ? "None"
        : (deckClass ?? metaClass);

    const imageLooksCougar = /cougar/i.test(image) || image.includes("cougar/mint");
    const imageLooksAlpaca = /alpaca/i.test(image);
    if (settleSide === "Alpaca" && imageLooksCougar && !imageLooksAlpaca) {
      bugs.push(
        `#${tokenId}: settlement side Alpaca but image path looks Cougar (${image.slice(0, 80)})`,
      );
    }
    if (settleSide === "Cougar" && imageLooksAlpaca && !imageLooksCougar) {
      bugs.push(
        `#${tokenId}: settlement side Cougar but image path looks Alpaca (${image.slice(0, 80)})`,
      );
    }
    if (!image) {
      bugs.push(
        `#${tokenId}: no metadata image — UI must use side-aware fallback (not always cougar.png)`,
      );
    }

    // Known mismatch: metadata may disagree with Testnet FY deck for unrevealed sale tokens.
    if (!revealed && deckSide && metaSide !== "Unknown" && deckSide !== metaSide) {
      bugs.push(
        `#${tokenId}: METADATA side=${metaSide} vs TESTNET DECK side=${deckSide} — settlement uses deck; image still from metadata (visual mismatch risk)`,
      );
    }

    rows.push({
      tokenId,
      onChainRevealed: revealed,
      onChain: { side: onChainSide, class: onChainClass },
      testnetDeck: deckSide ? { side: deckSide, class: deckClass } : null,
      metadata: { side: metaSide, class: metaClass, image: image.slice(0, 120) },
      settlementIdentity: { side: settleSide, class: settleClass },
    });
  }

  const outDir = join(__dirname, "..", "..", "reports", "testnet");
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, "nft-identity-mapping-audit.json");
  writeFileSync(
    path,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), rows, bugs }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ rows, bugs }, null, 2));
  console.log("Wrote", path);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
