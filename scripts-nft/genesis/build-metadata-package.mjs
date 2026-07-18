// Build the FINAL HANSOME Genesis 500 metadata package (NO Solidity, NO pinning).
// Self-contained in public/pixel/genesis/mint/. Artwork is UNCHANGED — the package COPIES the
// already-approved images (public composites + special art + reserved placeholders) into one folder.
// Enriches the 21 Special tokens' metadata (class/background/role/lore/accent) per the approved
// special-21 allocation, while the working public/pixel/genesis/ dir is left untouched.
import fs from "node:fs";
import path from "node:path";
import { validateSpecialToken } from "./validate-special.mjs";

const ROOT = "public/pixel/traits";
const GEN = JSON.parse(fs.readFileSync(path.join(ROOT, "generation-config.json"), "utf8"));
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, "special-21-allocation.json"), "utf8"));
const SRC_META = "public/pixel/genesis/metadata";      // existing final public metadata
const SRC_ART = "public/pixel/genesis";                 // public composites + reserved placeholders
const SRC_SPECIAL = "public/pixel/genesis/special";     // approved special art
const PKG = "public/pixel/genesis/mint";
const IMGDIR = path.join(PKG, "image");
const METADIR = path.join(PKG, "metadata");
const REPORTS = "reports/genesis/final";
for (const d of [IMGDIR, METADIR, REPORTS]) fs.mkdirSync(d, { recursive: true });

const IMAGE_CID = process.env.IMAGE_CID || "__IMAGE_CID__";
const imgRef = (id) => `ipfs://${IMAGE_CID}/${id}.png`;
const DESC_PUBLIC = "A HANSOME Genesis alpaca — an original individual of the cozy countryside HANSOME universe. Handcrafted pixel art. Not the mascot.";

const ABILITY = {
  King: "Permanent immunity to hunting penalty",
  Guardian: "Hunting penalty rate ×0.5",
  Farmer: "Effective location reward weight ×1.20 (normalized)",
  Lucky: "20% chance to fully avoid the day's hunting penalty",
  Runner: "30% chance to escape hunting (penalty = 0)",
  Common: "None",
};
const ACCENT = { King: "Founder Crown", Guardian: "Guardian Insignia Pin", Farmer: "Wheat Sprig", Lucky: "Clover", Runner: "Motion Streaks" };
const specialById = Object.fromEntries(SPEC.specials.map((s) => [s.tokenId, s]));
const reserved = GEN.tokenIdPolicy.reservedTokenIds.reservedAssignments; // 1-10
const reservedById = Object.fromEntries(reserved.map((r) => [r.tokenId, r]));

const copyImg = (from, id) => fs.copyFileSync(from, path.join(IMGDIR, `${id}.png`));
const write = (id, meta) => fs.writeFileSync(path.join(METADIR, `${id}.json`), JSON.stringify(meta, null, 2));

let counts = { Public: 0, Legendary: 0, Reserved: 0 };
let classCounts = { King: 0, Guardian: 0, Farmer: 0, Lucky: 0, Runner: 0, Common: 0 };

for (let id = 1; id <= 500; id++) {
  const sp = specialById[id];
  const res = reservedById[id];
  const isSpecial = !!sp; // 1, 11-30
  const isReservedCommon = !!res && !isSpecial; // 2-10

  if (isSpecial) {
    const type = id === 1 ? "Reserved" : "Legendary";
    const cls = sp.gameplayClass;
    const arch = sp.baseArchetype.split(" ")[0];
    const archLabel = arch.charAt(0).toUpperCase() + arch.slice(1);
    copyImg(path.join(SRC_SPECIAL, `${String(id).padStart(3, "0")}.png`), id);
    write(id, {
      name: `HANSOME Genesis #${id} — ${sp.roleName.split(" — ")[0]}`,
      description: sp.lore,
      image: imgRef(id),
      edition: id,
      attributes: [
        { trait_type: "Type", value: type },
        { trait_type: "Gameplay Class", value: cls },
        { trait_type: "Background", value: sp.background },
        { trait_type: "Archetype", value: id === 1 ? "Mascot (Founder)" : archLabel },
        { trait_type: "Class Accent", value: ACCENT[cls] },
      ],
      hansome: {
        type, gameplayClass: cls, ability: ABILITY[cls],
        specialBackground: sp.background, baseArchetype: sp.baseArchetype, role: sp.roleName,
        specialId: sp.specialId, excludedFromRarity: true, usesMascotAppearance: id === 1,
      },
    });
    counts[type]++; classCounts[cls]++;
  } else if (isReservedCommon) {
    copyImg(path.join(SRC_ART, `${id}.png`), id); // labelled placeholder tile (artwork pending hand-design)
    write(id, {
      name: `HANSOME Genesis #${id}`,
      description: `Reserved HANSOME Genesis NFT (${res.role}). A one-of-one held back from the public pool; hand-designed artwork pending.`,
      image: imgRef(id),
      edition: id,
      attributes: [
        { trait_type: "Type", value: "Reserved" },
        { trait_type: "Gameplay Class", value: "Common" },
        { trait_type: "Role", value: res.role },
      ],
      hansome: { type: "Reserved", gameplayClass: "Common", ability: "None", role: res.role, generation: "manual", artwork: "pending-hand-design", excludedFromRarity: true },
    });
    counts.Reserved++; classCounts.Common++;
  } else {
    // public 31-500 — re-emit existing final metadata into the package (unchanged traits/rarity),
    // adding Type + Gameplay Class up front and repointing image to the ipfs scheme.
    const m = JSON.parse(fs.readFileSync(path.join(SRC_META, `${id}.json`), "utf8"));
    copyImg(path.join(SRC_ART, `${id}.png`), id);
    write(id, {
      name: m.name,
      description: DESC_PUBLIC,
      image: imgRef(id),
      edition: id,
      attributes: [
        { trait_type: "Type", value: "Public" },
        { trait_type: "Gameplay Class", value: "Common" },
        ...m.attributes,
      ],
      hansome: { ...m.hansome, gameplayClass: "Common", ability: "None" },
    });
    counts.Public++; classCounts.Common++;
  }
}

// collection-level metadata
fs.writeFileSync(path.join(METADIR, "contract.json"), JSON.stringify({
  name: "HANSOME Genesis",
  description: "The Genesis collection of the HANSOME universe — 500 handcrafted pixel-art alpacas for Alpacas vs Cougars. 470 Public + 20 Legendary + 10 Reserved (incl. Founder #001). Each alpaca is an original individual; gameplay class drives how it plays. Rules per HANSOME GDS v1.1.",
  image: imgRef(1),
  external_link: "https://hansomealpacas.xyz",
  seller_fee_basis_points: 500,
  fee_recipient: "0x<treasury>",
}, null, 2));

// attribute schema
fs.writeFileSync(path.join(PKG, "attribute-schema.json"), JSON.stringify({
  standard: "ERC-721 Metadata (OpenSea-compatible) + `hansome` extension block",
  imageScheme: "ipfs://<IMAGE_CID>/<tokenId>.png (placeholder until pin)",
  types: { Public: "31-500 (470)", Legendary: "11-30 (20)", Reserved: "1-10 (10, incl. Founder #001)" },
  gameplayClasses: ["King", "Guardian", "Farmer", "Lucky", "Runner", "Common"],
  attributes: {
    common_to_all: ["Type", "Gameplay Class"],
    public: ["Background", "Archetype", "Wool", "Clothing", "Neck Accessory", "Mouth", "Ear Accessory", "Glasses", "Hat", "Effect"],
    special: ["Background", "Archetype", "Class Accent"],
    reserved_common: ["Role"],
  },
  hansomeBlock: {
    all: ["type", "gameplayClass", "ability"],
    public: ["archetype", "comboHash", "rarityRank", "rarityScore", "rarityOutOf"],
    special: ["specialBackground", "baseArchetype", "role", "specialId", "excludedFromRarity", "usesMascotAppearance"],
    reserved: ["role", "generation", "artwork", "excludedFromRarity"],
  },
  notes: "Only Public tokens carry a rarity model (rarityRank/Score). Legendary + Reserved are hand-authored one-of-ones, excluded from rarity. Gameplay Class ability text mirrors GDS v1.1 §4.1.",
}, null, 2));

console.log("counts", counts, "classes", classCounts);
fs.writeFileSync(path.join(REPORTS, "_pkg-counts.json"), JSON.stringify({ counts, classCounts }, null, 2));
