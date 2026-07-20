import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __markSettledForTests,
  __resetTestnetResolveCoordinatorForTests,
  getDayResolveSnapshot,
  setTestnetResolveTargets,
  stopTestnetResolveLoop,
} from "@/lib/game/testnetResolveCoordinator";

vi.mock("@/lib/game/testnetGaslessResolve", () => ({
  requestTestnetResolve: vi.fn(async ({ day }: { day: number }) => ({
    ok: true,
    enabled: true,
    day,
    alreadySettled: false,
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

  it("single-flights and marks day settled from response", async () => {
    setTestnetResolveTargets([7]);
    await vi.waitFor(() => {
      expect(getDayResolveSnapshot(7).settled).toBe(true);
    });
    expect(getDayResolveSnapshot(7).stage).toBe("completed");
    stopTestnetResolveLoop();
  });

  it("skips days already marked settled", async () => {
    __markSettledForTests(3);
    setTestnetResolveTargets([3]);
    await new Promise((r) => setTimeout(r, 50));
    expect(getDayResolveSnapshot(3).stage).toBe("completed");
    stopTestnetResolveLoop();
  });
});
