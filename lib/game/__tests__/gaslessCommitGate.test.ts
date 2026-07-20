import { describe, expect, it } from "vitest";
import {
  shouldBlockCommitForVault,
  VAULT_PERSIST_FAILED_MESSAGE,
} from "@/lib/game/gaslessCommitGate";

describe("shouldBlockCommitForVault", () => {
  it("does not block when gasless is disabled", () => {
    expect(
      shouldBlockCommitForVault({
        gaslessEnabled: false,
        persistOk: false,
      }),
    ).toEqual({ block: false });
  });

  it("blocks commit when vault persistence fails", () => {
    const result = shouldBlockCommitForVault({
      gaslessEnabled: true,
      persistOk: false,
      persistError: "Commit vault storage is not configured.",
    });
    expect(result.block).toBe(true);
    if (result.block) {
      expect(result.error).toContain("Commit vault storage is not configured.");
    }
  });

  it("uses actionable default message when persist fails without detail", () => {
    const result = shouldBlockCommitForVault({
      gaslessEnabled: true,
      persistOk: false,
    });
    expect(result).toEqual({
      block: true,
      error: VAULT_PERSIST_FAILED_MESSAGE,
    });
  });

  it("allows commit after successful vault persistence", () => {
    expect(
      shouldBlockCommitForVault({
        gaslessEnabled: true,
        persistOk: true,
      }),
    ).toEqual({ block: false });
  });
});
