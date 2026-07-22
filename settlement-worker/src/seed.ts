import { randomBytes } from "node:crypto";
import { keccak256, type Hex } from "viem";

/** Cryptographically strong day seed (not grindable from public clock alone). */
export function generateDaySeed(day: number, workerName: string): Hex {
  const entropy = randomBytes(32);
  const material = new Uint8Array(40 + workerName.length);
  const view = new DataView(material.buffer);
  view.setUint32(0, day, false);
  material.set(entropy, 4);
  material.set(Buffer.from(workerName, "utf8"), 36);
  return keccak256(material);
}
