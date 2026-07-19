/**
 * Build 540 packed identities assigned to sale token order (#11..#550),
 * mirroring Genesis processReveal Fisher–Yates with the committed reveal seed.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { keccak256, solidityPacked } from "ethers";
import { buildSaleIdentities } from "./genesis-identities";

function simulateSaleRevealShuffle(seed: bigint, saleCap = 540): number[] {
  const fy = new Map<number, bigint>();
  let remaining = saleCap;
  const out = new Array<number>(saleCap);

  for (let t = 0; t < saleCap; t++) {
    const h = keccak256(solidityPacked(["uint256", "uint256"], [seed, BigInt(t)]));
    const j = Number(BigInt(h) % BigInt(remaining));

    const rawJ = fy.get(j) ?? 0n;
    const chosen = rawJ === 0n ? BigInt(j) : rawJ - 1n;

    const last = remaining - 1;
    const rawLast = fy.get(last) ?? 0n;
    const lastVal = rawLast === 0n ? BigInt(last) : rawLast - 1n;
    fy.set(j, lastVal + 1n);
    remaining = last;

    out[t] = Number(chosen);
  }
  return out;
}

export function buildTestnetAssignedIdentities(): {
  assigned: Uint8Array;
  revealSeed: string;
} {
  const manifestPath = join(
    __dirname,
    "..",
    "..",
    "..",
    "reports",
    "genesis",
    "reveal-shuffle-manifest.json",
  );
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    revealSeed: string;
  };
  const seed = BigInt(manifest.revealSeed);
  const shuffle = simulateSaleRevealShuffle(seed, 540);
  const deck = buildSaleIdentities();
  const assigned = new Uint8Array(540);
  for (let t = 0; t < 540; t++) {
    assigned[t] = deck[shuffle[t]];
  }
  return { assigned, revealSeed: manifest.revealSeed };
}
