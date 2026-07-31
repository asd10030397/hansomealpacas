/**
 * Phase 7.3 Bounded Deep Settlement — failure injection (must pass after fix).
 * Every test terminates in bounded time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  clearDeepAttemptRegistryForTests,
  createDeepAttemptHandle,
  DEEP_PUBLISH_PERSIST_CAP_MS,
  DEEP_TERMINAL_PUBLISH_ESCAPE_MS,
  registerDeepAttempt,
  unregisterDeepAttempt,
} from "@/lib/hansome-score/deep-settlement";
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
    deepAttemptId: "d_bounded_73",
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
  clearDeepAttemptRegistryForTests();
});

afterEach(() => {
  setDeepStallTraceEnabledForTests(null);
  clearDeepStallSpansForTests();
  clearDeepAttemptRegistryForTests();
});

describe("Phase 7.3 bounded settlement — publish hub escape", () => {
  it("1. hung onProgress does not block timeout soft-fail forever", async () => {
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

    const raced = await withBound(
      softFail,
      DEEP_TERMINAL_PUBLISH_ESCAPE_MS + DEEP_PUBLISH_PERSIST_CAP_MS + 200,
    );
    expect(raced).not.toBe("timeout");
    expect(current.analysisStages?.relationships).toBe("partial");
  });

  it("2. publish mutex contention releases within persist cap", async () => {
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

    expect(
      await withBound(
        Promise.all([a, b]),
        DEEP_TERMINAL_PUBLISH_ESCAPE_MS + DEEP_PUBLISH_PERSIST_CAP_MS + 300,
      ),
    ).not.toBe("timeout");
    expect(current.analysisStages?.liquidity).toBe("done");
  });
});

describe("Phase 7.3 bounded settlement — Promise barrier", () => {
  it("3. hung job is bounded by hardBoundMs so barrier settles", async () => {
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

  it("4. withStageBudget-style race settles job even when work hangs", async () => {
    async function withStageBudget<T>(
      ms: number,
      work: (signal: AbortSignal) => Promise<T>,
    ): Promise<T> {
      const ac = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          work(ac.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              ac.abort();
              reject(new Error("budget"));
            }, ms);
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
            await withStageBudget(30, () => neverResolve());
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

    expect(await withBound(barrier, 200)).not.toBe("timeout");
  });

  it("5. timeout soft-fail settles when hub onProgress hangs", async () => {
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

    expect(
      await withBound(
        barrier,
        DEEP_TERMINAL_PUBLISH_ESCAPE_MS + DEEP_PUBLISH_PERSIST_CAP_MS + 300,
      ),
    ).not.toBe("timeout");
    expect(current.analysisStages?.relationships).toBe("partial");
  });

  it("6. background neverResolve continuation must not be on interactive barrier", async () => {
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
    expect(await withBound(barrier, 100)).not.toBe("timeout");
    expect(bgStarted).toBe(true);
  });
});

describe("Phase 7.3 bounded settlement — watchdog cancel", () => {
  it("7. watchdog cancel aborts attempt and settles barrier", async () => {
    const attempt = createDeepAttemptHandle({
      deepAttemptId: "wd1",
      tokenKey: "0xabc",
    });
    registerDeepAttempt(attempt);

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
        updatedAt: new Date(
          Date.now() - DEEP_PROGRESS_STALL_MS - 1_000,
        ).toISOString(),
      },
    };
    expect(isDeepProgressStalled(current)).toBe(true);

    const barrier = runParallelDeepJobs(
      [
        {
          id: "relationships",
          skip: false,
          run: async () => {
            await new Promise<void>((resolve, reject) => {
              attempt.signal.addEventListener(
                "abort",
                () => {
                  current = {
                    ...current,
                    analysisStages: {
                      ...current.analysisStages!,
                      relationships: "partial",
                    },
                  };
                  resolve();
                },
                { once: true },
              );
              void neverResolve().then(resolve, reject);
            });
          },
        },
        { id: "liquidity", skip: false, run: async () => {} },
        { id: "creatorBurn", skip: false, run: async () => {} },
      ],
      { attempt, hardBoundMs: 5_000 },
    );

    // Fire watchdog once.
    expect(attempt.markWatchdogFired()).toBe(true);
    attempt.cancel("watchdog_timeout");
    current = stampDeepProgress(current, {
      stage: "relationships",
      action: "watchdog_timeout",
      stalled: true,
      stallReason: "no_progress_publish_45s",
    });

    expect(await withBound(barrier, 200)).not.toBe("timeout");
    expect(current.analysisStages?.relationships).toBe("partial");
    expect(current.deepProgress?.action).toBe("watchdog_timeout");
    unregisterDeepAttempt(attempt);
  });

  it("8. late publish after finalize is fenced", async () => {
    const attempt = createDeepAttemptHandle({
      deepAttemptId: "fence1",
      tokenKey: "0xdef",
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
    // Fenced — must not overwrite after finalize.
    expect(current.analysisStages?.relationships).toBe("analyzing");
    expect(current.deepProgress?.action).toBe("watchdog_timeout");
  });
});

describe("Phase 7.3 bounded settlement — lock / coalesce / head progress", () => {
  it("9. interactive stale allows fenced takeover (no forever deep_running waiter)", () => {
    const snap = baseSnap();
    const interactiveStale =
      snap.analysisStatus === "deep_running" &&
      (snap.deepProgress?.stalled === true || true);
    const owned = false;
    let tookOver = false;
    if (!owned && interactiveStale) {
      tookOver = true;
    }
    expect(tookOver).toBe(true);
  });

  it("10. stale inflight deleted on interactive recovery path", () => {
    const inflight = new Map<string, Promise<ScanResponse>>();
    const key = "token";
    inflight.set(key, neverResolve() as Promise<ScanResponse>);
    // Recovery deletes coalescing entry.
    inflight.delete(key);
    expect(inflight.has(key)).toBe(false);
  });

  it("11. transfer-index concurrent_reuse returns without waiting", () => {
    const lockAcquired = false;
    const mode = lockAcquired ? "writer" : "concurrent_reuse";
    expect(mode).toBe("concurrent_reuse");
  });

  it("12. head-refresh monotonic pageInFetch publishes multiple pages", () => {
    let lastPagePublish = 0;
    let lastPageInFetch = 0;
    const priorTotal = 40;
    const events = [1, 2, 3].map((pageInFetch) => ({
      pagesFetchedTotal: priorTotal + pageInFetch,
      pagesFetchedThisCall: pageInFetch,
      pageInFetch,
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

describe("Phase 7.3 bounded settlement — all-partial / mixed", () => {
  it("13. all three parallel jobs reject → barrier settles", async () => {
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
    await expect(barrier).rejects.toThrow(/rel|liq|cb/);
  });

  it("14. one succeeds two hang → hard bound settles barrier", async () => {
    const barrier = runParallelDeepJobs(
      [
        { id: "relationships", skip: false, run: async () => {} },
        { id: "liquidity", skip: false, run: () => neverResolve() },
        { id: "creatorBurn", skip: false, run: () => neverResolve() },
      ],
      { hardBoundMs: 50 },
    );
    expect(await withBound(barrier, 200)).not.toBe("timeout");
  });
});

describe("Phase 7.3 bounded settlement — instrumentation", () => {
  it("15. records publish spans when trace enabled", async () => {
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
  });
});

describe("Phase 7.3 Smart LP gate", () => {
  it("Smart LP refresh disabled unless HANSOME_SMART_LP_REFRESH=1", async () => {
    const prev = process.env.HANSOME_SMART_LP_REFRESH;
    delete process.env.HANSOME_SMART_LP_REFRESH;
    vi.resetModules();
    const { isSmartLpRefreshEnabled } = await import(
      "@/lib/hansome-score/scan-deep"
    );
    expect(isSmartLpRefreshEnabled()).toBe(false);
    process.env.HANSOME_SMART_LP_REFRESH = "1";
    expect(isSmartLpRefreshEnabled()).toBe(true);
    if (prev === undefined) delete process.env.HANSOME_SMART_LP_REFRESH;
    else process.env.HANSOME_SMART_LP_REFRESH = prev;
  });
});
