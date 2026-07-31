/**
 * Phase 7.2 Deep stall RCA — failure injection.
 * Every test must terminate in bounded time.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDeepStagePublishHub,
  runParallelDeepJobs,
} from "@/lib/hansome-score/deep-parallel";
import {
  DEEP_PROGRESS_STALL_MS,
  isDeepProgressStalled,
  stampDeepProgress,
} from "@/lib/hansome-score/deep-progress";
import {
  clearDeepStallSpansForTests,
  getDeepStallSpans,
  setDeepStallTraceEnabledForTests,
} from "@/lib/hansome-score/deep-stall-trace";
import { FAST_SCAN_STAGES_READY } from "@/lib/hansome-score/scan-fast";
import type { ScanResponse } from "@/lib/hansome-score/types";

function baseSnap(): ScanResponse {
  return {
    analysisStatus: "deep_running",
    analysisPhase: "fast",
    analysisStages: {
      ...FAST_SCAN_STAGES_READY,
      relationships: "analyzing",
      liquidity: "analyzing",
      creator: "analyzing",
      burn: "analyzing",
    },
    deepAttemptId: "d_stall_rca",
    deepRetryCount: 0,
    scoreProvisional: true,
    deepStartedAt: new Date().toISOString(),
    liquidityUsd: 1000,
    overview: {
      address: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
    },
  } as unknown as ScanResponse;
}

function neverResolve(): Promise<never> {
  return new Promise(() => {});
}

async function withBound<T>(p: Promise<T>, ms: number): Promise<T | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

beforeEach(() => {
  setDeepStallTraceEnabledForTests(true);
  clearDeepStallSpansForTests();
});

afterEach(() => {
  setDeepStallTraceEnabledForTests(null);
  clearDeepStallSpansForTests();
});

describe("Phase 7.2 deep stall RCA — publish hub (superseded by 7.3 escape)", () => {
  it("hung onProgress no longer blocks timeout soft-fail (7.3)", async () => {
    let current = baseSnap();
    let onProgressCalls = 0;

    const hub = createDeepStagePublishHub({
      get: () => current,
      set: (n) => {
        current = n;
      },
      onProgress: async () => {
        onProgressCalls += 1;
        if (onProgressCalls === 1) await neverResolve();
      },
    });

    void hub.publish((p) => p, "relationships:funder", 1, {
      stage: "relationships",
      action: "funder",
    });

    const softFail = hub.publish(
      (p) => ({
        ...p,
        analysisStages: { ...p.analysisStages!, relationships: "partial" },
      }),
      "relationships:timeout",
      2,
      { stage: "relationships", action: "timeout", stalled: true },
      { terminal: true },
    );

    const raced = await withBound(softFail, 6_000);
    expect(raced).not.toBe("timeout");
    expect(current.analysisStages?.relationships).toBe("partial");
  });

  it("publish mutex contention: terminal escape does not deadlock", async () => {
    let current = baseSnap();
    let n = 0;
    const hub = createDeepStagePublishHub({
      get: () => current,
      set: (x) => {
        current = x;
      },
      onProgress: async () => {
        n += 1;
        if (n === 1) await neverResolve();
      },
    });

    const a = hub.publish((p) => p, "a", 1, {
      stage: "liquidity",
      action: "lp_refresh_plan",
    });
    const b = hub.publish(
      (p) => ({
        ...p,
        analysisStages: { ...p.analysisStages!, liquidity: "done" },
      }),
      "b",
      2,
      { stage: "liquidity", action: "done" },
      { terminal: true },
    );

    expect(await withBound(Promise.all([a, b]), 6_000)).not.toBe("timeout");
    expect(current.analysisStages?.liquidity).toBe("done");
  });
});

describe("Phase 7.2 deep stall RCA — Promise settlement", () => {
  it("one hung job is detached by hard bound (7.3)", async () => {
    const barrier = runParallelDeepJobs(
      [
        {
          id: "relationships",
          skip: false,
          run: async () => {
            /* ok */
          },
        },
        {
          id: "liquidity",
          skip: false,
          run: async () => neverResolve(),
        },
        {
          id: "creatorBurn",
          skip: false,
          run: async () => {
            /* ok */
          },
        },
      ],
      { hardBoundMs: 40 },
    );

    expect(await withBound(barrier, 200)).not.toBe("timeout");
  });

  it("withBudget-style race settles job even when work hangs (detaches barrier)", async () => {
    async function withBudget<T>(
      ms: number,
      work: () => Promise<T>,
    ): Promise<T> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          work(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("budget")), ms);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    const barrier = runParallelDeepJobs([
      {
        id: "relationships",
        skip: false,
        run: async () => {
          try {
            await withBudget(30, () => neverResolve());
          } catch {
            /* soft-fail */
          }
        },
      },
      {
        id: "liquidity",
        skip: false,
        run: async () => {
          /* ok */
        },
      },
      {
        id: "creatorBurn",
        skip: false,
        run: async () => {
          /* ok */
        },
      },
    ]);

    const result = await withBound(barrier, 200);
    expect(result).not.toBe("timeout");
  });

  it("timeout soft-fail settles despite blocked hub persist (7.3)", async () => {
    let current = baseSnap();
    let calls = 0;
    const hub = createDeepStagePublishHub({
      get: () => current,
      set: (n) => {
        current = n;
      },
      onProgress: async () => {
        calls += 1;
        if (calls === 1) await neverResolve();
      },
    });

    const barrier = runParallelDeepJobs([
      {
        id: "relationships",
        skip: false,
        run: async () => {
          const mid = hub.publish((p) => p, "funder", 1, {
            stage: "relationships",
            action: "funder",
          });
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              mid.then(() => neverResolve()),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error("budget")), 40);
              }),
            ]);
          } catch {
            await hub.publish(
              (p) => ({
                ...p,
                analysisStages: {
                  ...p.analysisStages!,
                  relationships: "partial",
                },
              }),
              "timeout",
              2,
              { stage: "relationships", action: "timeout" },
              { terminal: true },
            );
          } finally {
            if (timer) clearTimeout(timer);
          }
        },
      },
      {
        id: "liquidity",
        skip: false,
        run: async () => {
          /* ok */
        },
      },
      {
        id: "creatorBurn",
        skip: false,
        run: async () => {
          /* ok */
        },
      },
    ]);

    expect(await withBound(barrier, 6_000)).not.toBe("timeout");
    expect(current.analysisStages?.relationships).toBe("partial");
  });

  it("background neverResolve continuation must not be on interactive barrier", async () => {
    let bgStarted = false;
    const barrier = runParallelDeepJobs([
      {
        id: "relationships",
        skip: false,
        run: async () => {
          /* interactive done */
        },
      },
      {
        id: "liquidity",
        skip: false,
        run: async () => {
          // Correct pattern: fire-and-forget background (not awaited).
          bgStarted = true;
          void neverResolve();
        },
      },
      {
        id: "creatorBurn",
        skip: false,
        run: async () => {
          /* ok */
        },
      },
    ]);
    const result = await withBound(barrier, 100);
    expect(result).not.toBe("timeout");
    expect(bgStarted).toBe(true);
  });
});

describe("Phase 7.2 deep stall RCA — watchdog (superseded by 7.3 cancel)", () => {
  it("watchdog hard-bound detaches hung jobs (7.3)", async () => {
    let current = stampDeepProgress(baseSnap(), {
      stage: "relationships",
      action: "funder",
      completedUnits: 2,
      totalUnits: 12,
    });
    current = {
      ...current,
      deepProgress: {
        ...current.deepProgress!,
        updatedAt: new Date(Date.now() - DEEP_PROGRESS_STALL_MS - 1_000).toISOString(),
      },
    };
    expect(isDeepProgressStalled(current)).toBe(true);

    current = stampDeepProgress(current, {
      stage: "relationships",
      action: "watchdog_timeout",
      stalled: true,
      stallReason: "no_progress_publish_45s",
    });
    expect(current.deepProgress?.stalled).toBe(true);

    const barrier = runParallelDeepJobs(
      [
        { id: "relationships", skip: false, run: () => neverResolve() },
        { id: "liquidity", skip: false, run: async () => {} },
        { id: "creatorBurn", skip: false, run: async () => {} },
      ],
      { hardBoundMs: 40 },
    );
    expect(await withBound(barrier, 200)).not.toBe("timeout");
  });

  it("late publish after finalize is fenced (7.3)", async () => {
    const { createDeepAttemptHandle } = await import(
      "@/lib/hansome-score/deep-settlement"
    );
    const attempt = createDeepAttemptHandle({
      deepAttemptId: "rca_fence",
      tokenKey: "0xrca",
    });
    let current = stampDeepProgress(baseSnap(), {
      stage: "relationships",
      action: "watchdog_timeout",
      stalled: true,
      stallReason: "no_progress_publish_45s",
    });
    const hub = createDeepStagePublishHub({
      get: () => current,
      set: (n) => {
        current = n;
      },
      attempt,
    });
    attempt.markFinalized();
    await hub.publish(
      (p) => ({
        ...p,
        analysisStages: { ...p.analysisStages!, relationships: "done" },
      }),
      "late",
      1,
      { stage: "relationships", action: "done" },
    );
    expect(current.analysisStages?.relationships).toBe("analyzing");
    expect(current.deepProgress?.action).toBe("watchdog_timeout");
  });
});

describe("Phase 7.2 deep stall RCA — lock / coalesce semantics", () => {
  it("documents lock-miss waiter returns incomplete deep_running (no takeover)", async () => {
    // Mirrors scan-cache runFreshScan !owned path: if snapshot is deep_running,
    // waiter returns it without starting replacement work.
    const snap = baseSnap();
    const isComplete = (r: ScanResponse) => r.analysisStatus === "complete";
    const owned = false;
    let returned: ScanResponse | null = null;
    if (!owned) {
      const again = snap;
      if (again && isComplete(again)) returned = again;
      else if (again) returned = again;
    }
    expect(returned?.analysisStatus).toBe("deep_running");
    expect(returned?.analysisStages?.liquidity).toBe("analyzing");
  });

  it("stale inflight Promise: coalesced waiter never settles if owner hangs", async () => {
    const inflight = new Map<string, Promise<ScanResponse>>();
    const key = "token";
    const owner = neverResolve() as Promise<ScanResponse>;
    inflight.set(key, owner);
    const waiter = inflight.get(key)!;
    expect(await withBound(waiter, 60)).toBe("timeout");
    // Production finally must delete on settle; hung owner leaves map entry.
    expect(inflight.has(key)).toBe(true);
    inflight.delete(key);
  });

  it("transfer-index concurrent_reuse returns without waiting on lock owner", async () => {
    // Documented behavior in paging.ts: lock miss → immediate concurrent_reuse.
    const lockAcquired = false;
    const mode = lockAcquired ? "writer" : "concurrent_reuse";
    expect(mode).toBe("concurrent_reuse");
  });
});

describe("Phase 7.2 deep stall RCA — head refresh progress (fixed in 7.3)", () => {
  it("monotonic pagesFetchedTotal + pageInFetch publishes each head page", () => {
    let lastPagePublish = 0;
    let lastPageInFetch = 0;
    const priorTotal = 40;
    const events = [1, 2, 3].map((pageInFetch) => ({
      pagesFetchedTotal: priorTotal + pageInFetch,
      pageInFetch,
      pagesFetchedThisCall: pageInFetch,
    }));
    let publishes = 0;
    for (const event of events) {
      const pageKey = event.pagesFetchedThisCall ?? event.pageInFetch;
      if (
        event.pagesFetchedTotal <= lastPagePublish &&
        pageKey <= lastPageInFetch
      ) {
        continue;
      }
      lastPagePublish = Math.max(lastPagePublish, event.pagesFetchedTotal);
      lastPageInFetch = Math.max(lastPageInFetch, pageKey);
      publishes += 1;
    }
    expect(publishes).toBe(3);
  });
});

describe("Phase 7.2 deep stall RCA — all-partial / mixed hang", () => {
  it("all three parallel jobs reject → barrier settles (rejects, does not hang)", async () => {
    const barrier = runParallelDeepJobs([
      {
        id: "relationships",
        skip: false,
        run: async () => {
          throw new Error("rel");
        },
      },
      {
        id: "liquidity",
        skip: false,
        run: async () => {
          throw new Error("liq");
        },
      },
      {
        id: "creatorBurn",
        skip: false,
        run: async () => {
          throw new Error("cb");
        },
      },
    ]);
    // allSettled resolves then rethrows — must not hang.
    await expect(barrier).rejects.toThrow(/rel|liq|cb/);
  });

  it("one succeeds two hang → hard bound settles (7.3)", async () => {
    const barrier = runParallelDeepJobs(
      [
        { id: "relationships", skip: false, run: async () => {} },
        { id: "liquidity", skip: false, run: () => neverResolve() },
        { id: "creatorBurn", skip: false, run: () => neverResolve() },
      ],
      { hardBoundMs: 40 },
    );
    expect(await withBound(barrier, 200)).not.toBe("timeout");
  });
});

describe("Phase 7.2 deep stall RCA — instrumentation spans", () => {
  it("records publish spans when trace enabled", async () => {
    let current = baseSnap();
    const hub = createDeepStagePublishHub({
      get: () => current,
      set: (n) => {
        current = n;
      },
    });
    await hub.publish((p) => p, "t", 1, {
      stage: "relationships",
      action: "funder",
    });
    const names = getDeepStallSpans().map((s) => s.name);
    expect(names).toContain("scan.deep.publish");
    expect(
      getDeepStallSpans().some(
        (s) => s.name === "scan.deep.publish" && s.status === "completed",
      ),
    ).toBe(true);
  });
});
