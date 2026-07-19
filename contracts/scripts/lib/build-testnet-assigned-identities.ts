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

/**
 * Pack: bit7 = Cougar, low nibble = GameplayClass (Alpaca only).
 * After FY, swap rare classes into early sale slots so minted Testnet
 * inventory (~#11..#30) can exercise the full ability set.
 * Preserves overall class counts (swap only).
 */
function densifyQaSamples(assigned: Uint8Array): void {
  const packFor = (want: number): number => {
    for (let i = 0; i < assigned.length; i++) {
      if (assigned[i] === want) return i;
    }
    throw new Error(`Deck missing packed identity 0x${want.toString(16)}`);
  };
  const swapInto = (preferIndex: number, packed: number) => {
    if (assigned[preferIndex] === packed) return;
    const from = packFor(packed);
    const tmp = assigned[preferIndex]!;
    assigned[preferIndex] = packed;
    assigned[from] = tmp;
  };
  // Sale index = tokenId - 11
  swapInto(0, 0x01); // #11 Common
  swapInto(1, 0x02); // #12 Guardian
  swapInto(2, 0x03); // #13 Farmer
  swapInto(3, 0x04); // #14 Lucky
  swapInto(4, 0x05); // #15 Runner
  swapInto(5, 0x80); // #16 Cougar
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
  densifyQaSamples(assigned);
  return { assigned, revealSeed: manifest.revealSeed };
}
