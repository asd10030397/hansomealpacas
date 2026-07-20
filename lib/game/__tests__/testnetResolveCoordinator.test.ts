import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __markRelayerUnavailableForTests,
  __markSettledForTests,
  __resetTestnetResolveCoordinatorForTests,
  getDayResolveSnapshot,
  getTestnetResolveServiceNotice,
  isTestnetResolveServiceUnavailable,
  setTestnetResolveTargets,
  stopTestnetResolveLoop,
} from "@/lib/game/testnetResolveCoordinator";
import { requestTestnetResolve } from "@/lib/game/testnetGaslessResolve";

vi.mock("@/lib/game/testnetGaslessResolve", () => ({
  fetchTestnetResolveStatus: vi.fn(async () => ({
    ok: true,
    enabled: true,
    relayerConfigured: true,
    canResolve: true,
  })),
  isRelayerNotConfiguredResponse: (r: {
    relayerConfigured?: boolean;
    code?: string;
  }) => r.relayerConfigured === false || r.code === "RELAYER_NOT_CONFIGURED",
  requestTestnetResolve: vi.fn(async ({ day }: { day: number }) => ({
    ok: true,
    enabled: true,
    day,
    alreadySettled: true,
    fullySettled: true,
    battleReady: true,
    finalized: true,
    settleTxHash: "0xsettle",
    revealed: 1,
    stage: "completed",
    timings: {
      totalMs: 800,
      seedMs: 100,
      revealMs: 200,
      settleMs: 500,
      stage: "completed" as const,
    },
  })),
}));

describe("testnetResolveCoordinator", () => {
  afterEach(() => {
    __resetTestnetResolveCoordinatorForTests();
    vi.clearAllMocks();
  });

  it("single-flights and marks day settled when credits complete", async () => {
    setTestnetResolveTargets([7]);
    await vi.waitFor(() => {
      expect(getDayResolveSnapshot(7).settled).toBe(true);
    });
    expect(getDayResolveSnapshot(7).stage).toBe("completed");
    stopTestnetResolveLoop();
  });

  it("battle-ready without credits does not mark settled; stage is crediting", async () => {
    vi.mocked(requestTestnetResolve).mockResolvedValueOnce({
      ok: true,
      enabled: true,
      day: 11,
      alreadySettled: false,
      fullySettled: false,
      battleReady: true,
      finalized: true,
      creditsPending: true,
      settleTxHash: "0xfinalize",
      revealed: 2,
      stage: "crediting",
      timings: {
        totalMs: 400,
        seedMs: 50,
        revealMs: 100,
        settleMs: 200,
        stage: "crediting",
      },
    });

    setTestnetResolveTargets([11]);
    await vi.waitFor(() => {
      expect(getDayResolveSnapshot(11).stage).toBe("crediting");
    });
    expect(getDayResolveSnapshot(11).settled).toBe(false);
    stopTestnetResolveLoop();
  });

  it("skips days already marked settled", async () => {
    __markSettledForTests(3);
    setTestnetResolveTargets([3]);
    await new Promise((r) => setTimeout(r, 50));
    expect(getDayResolveSnapshot(3).stage).toBe("completed");
    stopTestnetResolveLoop();
  });

  it("stops polling when relayer is not configured", async () => {
    const { fetchTestnetResolveStatus } = await import(
      "@/lib/game/testnetGaslessResolve"
    );
    vi.mocked(fetchTestnetResolveStatus).mockResolvedValueOnce({
      ok: true,
      enabled: true,
      relayerConfigured: false,
      canResolve: false,
      error: "Testnet relayer is not configured on this server.",
    });

    setTestnetResolveTargets([9]);
    await vi.waitFor(() => {
      expect(isTestnetResolveServiceUnavailable()).toBe(true);
    });
    expect(getTestnetResolveServiceNotice()).toMatch(/not configured/i);
    expect(requestTestnetResolve).not.toHaveBeenCalled();
    stopTestnetResolveLoop();
  });

  it("keeps a single session notice after mark unavailable", () => {
    __markRelayerUnavailableForTests(
      "Testnet relayer is not configured on this server.",
    );
    __markRelayerUnavailableForTests("second message ignored");
    expect(getTestnetResolveServiceNotice()).toBe(
      "Testnet relayer is not configured on this server.",
    );
  });
});
