/**
 * Export FY+QA densified Testnet trait deck for the Next.js UI
 * (lib/game/data/testnetAssigned540.json).
 *
 * Usage: npx hardhat run scripts/export-testnet-assigned-json.ts --network robinhoodTestnet
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildTestnetAssignedIdentities } from "./lib/build-testnet-assigned-identities";

async function main() {
  const { assigned, revealSeed } = buildTestnetAssignedIdentities();
  const outPath = join(
    __dirname,
    "..",
    "..",
    "lib",
    "game",
    "data",
    "testnetAssigned540.json",
  );
  const body = {
    revealSeed,
    assigned: Array.from(assigned),
    samples: {
      "Alpaca:Common": 11,
      "Alpaca:Guardian": 12,
      "Alpaca:Farmer": 13,
      "Alpaca:Lucky": 14,
      "Alpaca:Runner": 15,
      Cougar: 16,
      "Alpaca:King": 1,
    },
  };
  writeFileSync(outPath, `${JSON.stringify(body)}\n`);
  console.log("Wrote", outPath);
  console.log("samples", body.samples);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
