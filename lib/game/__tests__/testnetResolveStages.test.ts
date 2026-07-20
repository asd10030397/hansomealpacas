import { describe, expect, it } from "vitest";
import {
  stageFromResolveFlags,
  summarizeTimingSamples,
} from "@/lib/game/testnetResolveStages";

describe("stageFromResolveFlags", () => {
  it("marks completed only when credits are done; finalized → crediting", () => {
    expect(
      stageFromResolveFlags({ alreadySettled: true }),
    ).toBe("completed");
    expect(
      stageFromResolveFlags({ settleTxHash: "0xabc", finalized: true }),
    ).toBe("crediting");
  });

  it("marks waiting_seed when seed missing", () => {
    expect(stageFromResolveFlags({ hasSeed: false })).toBe("waiting_seed");
  });

  it("marks revealing then settling from reveal progress", () => {
    expect(
      stageFromResolveFlags({
        hasSeed: true,
        revealTxHash: "0x1",
        revealed: 2,
      }),
    ).toBe("settling");
  });
});

describe("summarizeTimingSamples", () => {
  it("identifies settle as bottleneck when settle dominates", () => {
    const summary = summarizeTimingSamples([
      {
        day: 1,
        at: 1,
        ok: true,
        alreadySettled: false,
        totalMs: 12_000,
        seedMs: 1_000,
        revealMs: 2_000,
        settleMs: 9_000,
        stage: "completed",
      },
      {
        day: 2,
        at: 2,
        ok: true,
        alreadySettled: false,
        totalMs: 14_000,
        seedMs: 1_200,
        revealMs: 2_500,
        settleMs: 10_000,
        stage: "completed",
      },
    ]);
    expect(summary.count).toBe(2);
    expect(summary.avgTotalMs).toBe(13_000);
    expect(summary.maxTotalMs).toBe(14_000);
    expect(summary.bottleneck).toBe("settle");
  });
});
