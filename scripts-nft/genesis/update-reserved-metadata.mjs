// Update mint metadata for Reserved Special Alpacas #001–#010 (class map locked).
// Does not regenerate artwork.
import fs from "node:fs";
import path from "node:path";

const ABILITY = {
  King: "Permanent immunity to hunting penalty",
  Guardian: "Hunting penalty rate ×0.5",
  Farmer: "Effective location reward weight ×1.20 (normalized)",
  Lucky: "20% chance to fully avoid the day's hunting penalty",
  Runner: "30% chance to escape hunting (penalty = 0)",
};
const ACCENT = {
  King: "Founder Crown",
  Guardian: "Guardian Insignia Pin",
  Farmer: "Wheat Sprig",
  Lucky: "Clover",
  Runner: "Motion Streaks",
};
const BG = { King: "king", Guardian: "guardian", Farmer: "farmer", Lucky: "lucky", Runner: "runner" };
const MAP = [
  [1, "King", true],
  [2, "Guardian", false],
  [3, "Guardian", false],
  [4, "Farmer", false],
  [5, "Farmer", false],
  [6, "Lucky", false],
  [7, "Lucky", false],
  [8, "Runner", false],
  [9, "Runner", false],
  [10, "Runner", false],
];

const dir = "public/pixel/genesis/mint/metadata";
for (const [id, cls, mascot] of MAP) {
  const attrs = [
    { trait_type: "Side", value: "Alpaca" },
    { trait_type: "Type", value: "Reserved" },
    { trait_type: "Gameplay Class", value: cls },
    { trait_type: "Background", value: BG[cls] },
  ];
  if (id === 1) attrs.push({ trait_type: "Archetype", value: "Mascot (Founder)" });
  attrs.push({ trait_type: "Class Accent", value: ACCENT[cls] });

  const meta = {
    name:
      id === 1
        ? "HANSOME Genesis #1 — The Founder King"
        : `HANSOME Genesis #${id} — Reserved Special (${cls})`,
    description:
      id === 1
        ? "The first alpaca of the meadow and the origin of the whole herd. Where HANSOME walks, the village follows. He wears the crown of the pasture kingdom not as a ruler over others, but as the one who remembers every alpaca's name."
        : `A Reserved Special Alpaca of HANSOME Genesis. Reserved status is ownership allocation only. Gameplay power comes only from Gameplay Class (${cls}). Not a Common.`,
    image: `ipfs://__IMAGE_CID__/${id}.png`,
    edition: id,
    attributes: attrs,
    hansome: {
      side: "Alpaca",
      type: "Reserved",
      gameplayClass: cls,
      ability: ABILITY[cls],
      specialBackground: BG[cls],
      allocation: "reserved-special",
      excludedFromRarity: true,
      usesMascotAppearance: !!mascot,
    },
  };
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(meta, null, 2) + "\n");
}
console.log("Updated mint metadata for Reserved Specials #001–#010");
