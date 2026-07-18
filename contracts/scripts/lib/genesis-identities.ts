/** Packed sale identities for the 540 sale slots (matches test composition). */
export const SALE_CAP = 540;

/**
 * Sale identity bytes (540):
 * - 50 Cougar (0x80)
 * - 479 Common Alpaca (1)
 * - 3 Guardian (2), 3 Farmer (3), 3 Lucky (4), 2 Runner (5)
 */
export function buildSaleIdentities(): Uint8Array {
  const bytes = new Uint8Array(SALE_CAP);
  let i = 0;
  const push = (v: number, n: number) => {
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
