import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSupersededContractAddress,
  resolveHansomeGameAddress,
  SUPERSEDED_TESTNET_ADDRESSES,
} from "@/lib/game/contractAddresses";

const CANONICAL_GAME = "0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("contractAddresses fail-closed", () => {
  it("missing required game address fails closed", () => {
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", "");
    const r = resolveHansomeGameAddress();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/missing/i);
  });

  it("invalid address fails closed", () => {
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", "not-an-address");
    const bad = resolveHansomeGameAddress();
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/invalid/i);
  });

  it("old superseded address is not accepted as fallback", () => {
    for (const old of SUPERSEDED_TESTNET_ADDRESSES) {
      expect(isSupersededContractAddress(old)).toBe(true);
      vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", old);
      const r = resolveHansomeGameAddress();
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/superseded/i);
    }
  });

  it("correct env address resolves successfully", () => {
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", CANONICAL_GAME);
    const r = resolveHansomeGameAddress();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.address).toBe(CANONICAL_GAME);
  });

  it("zero address fails closed", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_HANSOME_GAME_ADDRESS",
      "0x0000000000000000000000000000000000000000",
    );
    const r = resolveHansomeGameAddress();
    expect(r.ok).toBe(false);
  });
});
