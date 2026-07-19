import { beforeEach, describe, expect, it, vi } from "vitest";

describe("commitSecret wallet scoping", () => {
  beforeEach(() => {
    vi.resetModules();
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(`session:${k}`) ?? null,
      setItem: (k: string, v: string) => {
        store.set(`session:${k}`, v);
      },
      removeItem: (k: string) => {
        store.delete(`session:${k}`);
      },
    });
  });

  it("isolates secrets per wallet and filters by ownership", async () => {
    const {
      upsertCommitSecret,
      listCommitSecretsForDay,
      listOwnedCommitSecretsForDay,
      getCommitSecret,
      generateSalt,
    } = await import("@/lib/game/commitSecret");

    const salt = generateSalt();
    upsertCommitSecret({
      tokenId: 11,
      day: 1,
      locationId: 2,
      salt,
      status: "submitted",
      wallet: "0xAAA0000000000000000000000000000000000001",
    });
    upsertCommitSecret({
      tokenId: 30,
      day: 1,
      locationId: 1,
      salt: generateSalt(),
      status: "submitted",
      wallet: "0xBBB0000000000000000000000000000000000002",
    });

    const walletA = "0xAaa0000000000000000000000000000000000001";
    expect(listCommitSecretsForDay(1, walletA).map((s) => s.tokenId)).toEqual([
      11,
    ]);
    expect(listCommitSecretsForDay(1, null)).toEqual([]);
    expect(getCommitSecret(30, 1, walletA)).toBeNull();
    expect(
      listOwnedCommitSecretsForDay(1, walletA, [11, 99]).map((s) => s.tokenId),
    ).toEqual([11]);
    expect(listOwnedCommitSecretsForDay(1, walletA, [99])).toEqual([]);
  });
});
