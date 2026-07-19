/**
 * Mirror HansomeGenesisNFT._fyTake / processReveal sale shuffle (Solidity).
 * Uses ethers keccak256(abi.encodePacked(uint256 seed, uint256 salt)).
 */
import { keccak256, solidityPacked } from "./ethers-local.mjs";

/**
 * @param {bigint|string|number} seed
 * @param {number} saleCap default 540
 * @returns {number[]} identityIndexBySaleSlot[0..539] — index into the 540-byte identity deck
 */
export function simulateSaleRevealShuffle(seed, saleCap = 540) {
  const seedBn = BigInt(seed);
  /** @type {Map<number, bigint>} */
  const fy = new Map();
  let remaining = saleCap;
  const out = new Array(saleCap);

  for (let t = 0; t < saleCap; t++) {
    if (remaining === 0) throw new Error("fy remaining exhausted early");
    const salt = BigInt(t);
    const h = keccak256(solidityPacked(["uint256", "uint256"], [seedBn, salt]));
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

/** Packed sale identities matching contracts/scripts/lib/genesis-identities.ts */
export function buildSaleIdentityBytes() {
  const SALE_CAP = 540;
  const bytes = new Uint8Array(SALE_CAP);
  let i = 0;
  const push = (v, n) => {
    for (let k = 0; k < n; k++) bytes[i++] = v;
  };
  push(0x80, 50);
  push(1, 479);
  push(2, 3);
  push(3, 3);
  push(4, 3);
  push(5, 2);
  if (i !== SALE_CAP) throw new Error(`bad sale identity length ${i}`);
  return bytes;
}

export function packedClassLabel(packed) {
  if ((packed & 0x80) !== 0) return { side: "Cougar", class: "None" };
  const cls = packed & 0x0f;
  const map = {
    1: "Common",
    2: "Guardian",
    3: "Farmer",
    4: "Lucky",
    5: "Runner",
  };
  return { side: "Alpaca", class: map[cls] ?? `Unknown(${cls})` };
}
