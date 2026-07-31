/**
 * Phase 10C-3 — hung factory/index must not drop parallel Pons adapter PASS.
 */
import { describe, expect, it, vi } from "vitest";

const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";

vi.mock("@/lib/hansome-score/lp/lockers", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/hansome-score/lp/lockers")
  >("@/lib/hansome-score/lp/lockers");
  return {
    ...actual,
    discoverV3LockerPositions: vi.fn(async () => [
      {
        adapterId: "pons_launch" as const,
        lockerName: "PonsLaunchLocker",
        lockerAddress: PONS,
        positionNftId: "436637",
        owner: PONS,
        positionManager: "0x73991a25c818bf1f1128deaab1492d45638de0d3",
        poolOrPair: "0xC71E763a0a258f266d1481295115ea4f291D95ED",
        fee: 10000,
        liquidity: "36819258015569838458222",
        tickLower: -887200,
        tickUpper: 204200,
        currency0: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
        currency1: BEER,
        unlockTimestamp: null,
        evidenceLevel: "on_chain_verified" as const,
        dataSource: "test-pons",
      },
    ]),
  };
});

vi.mock("@/lib/hansome-score/lp/v3-position-index/production", () => ({
  resolveV3PositionsFromIndex: vi.fn(
    () =>
      new Promise(() => {
        /* hang */
      }),
  ),
}));

import { discoverV3Liquidity } from "@/lib/hansome-score/lp/adapters/v3";
import {
  lpEvidenceNeedsFullRefresh,
  rearmPartialForDeepRetry,
} from "@/lib/hansome-score/scan-progress";
import type { ScanResponse } from "@/lib/hansome-score/types";

describe("Phase 10C-3 sticky timeout LP refresh", () => {
  it("forces liquidity re-arm when detail is probe-budget / finish-in-time", () => {
    const snap = {
      analysisStatus: "partial",
      analysisStages: {
        contract: "done",
        holders: "done",
        market: "done",
        burn: "done",
        liquidity: "done",
        creator: "done",
        relationships: "done",
        score: "done",
      },
      overview: {
        lpIntelligence: {
          detail:
            "v3: probe budget exceeded (60000ms) — incomplete. Temporarily unavailable — liquidity did not finish in time.",
          positions: [],
          aggregateState: "UNKNOWN_INCOMPLETE",
        },
      },
    } as unknown as ScanResponse;
    expect(lpEvidenceNeedsFullRefresh(snap)).toBe(true);
    const rearmed = rearmPartialForDeepRetry(snap);
    expect(rearmed.analysisStages?.liquidity).toBe("analyzing");
    expect(rearmed.analysisStatus).toBe("deep_running");
  });
});

describe("Phase 10C-3 Pons parallel soft-wall", () => {
  it("returns LOCKED_VERIFIED_ONCHAIN when factory reads hang past soft wall", async () => {
    const hungClient = {
      readContract: () => new Promise(() => {}),
    };
    const result = await discoverV3Liquidity({
      tokenAddress: BEER,
      client: hungClient as never,
      factoryIndexSoftMs: 60,
    });
    const locked = result.positions.filter(
      (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
    );
    expect(locked).toHaveLength(1);
    expect(locked[0]?.positionNftId).toBe("436637");
    expect(locked[0]?.lockerName).toBe("PonsLaunchLocker");
    expect(JSON.parse(JSON.stringify(locked[0])).lockState).toBe(
      "LOCKED_VERIFIED_ONCHAIN",
    );
  });
});
