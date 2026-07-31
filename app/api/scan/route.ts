import { after, NextResponse } from "next/server";
import { PROJECT } from "@/content/project";
import { HANSOME_TOKEN } from "@/lib/hansome-score";
import {
  bindAndAssertDeploymentScope,
  DeploymentScopeIsolationError,
  resolveDeploymentScope,
} from "@/lib/hansome-score/deployment-scope";
import {
  ensureDeepAnalysis,
  getCachedScan,
} from "@/lib/hansome-score/scan-cache";
import {
  httpStatusForScanError,
  scanErrorJson,
} from "@/lib/hansome-score/scan-errors";
import { isDeepInProgress } from "@/lib/hansome-score/scan-fast";
import { scheduleSuccessfulScanAnalytics } from "@/lib/scan-analytics";
import type { ScanResponse } from "@/lib/hansome-score/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Fast Scan returns in seconds. Deep continues via `after()` and is bounded by
 * this maxDuration (Vercel Pro serverless ceiling) + DEEP_SCAN_MAX_EXECUTION_MS.
 */
export const maxDuration = 300;

function clientIp(request: Request): string | null {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

function parseRefreshFlag(
  searchParams: URLSearchParams,
  bodyRefresh?: boolean,
): boolean {
  if (bodyRefresh) return true;
  const r = searchParams.get("refresh");
  return r === "1" || r === "true";
}

function scheduleAfterDeep(address: string, result: ScanResponse) {
  if (!isDeepInProgress(result)) return;
  after(() => {
    void ensureDeepAnalysis(address).catch(async (err) => {
      console.warn(`[${PROJECT.symbol}] deep analysis after() failed:`, err);
      // Phase 13A: worker launch / after() failure must not leave orphan analyzing.
      try {
        const { recoverOrphanAnalyzingIfNeeded } = await import(
          "@/lib/hansome-score/scan-cache"
        );
        await recoverOrphanAnalyzingIfNeeded(address);
      } catch (recoverErr) {
        console.warn(
          `[${PROJECT.symbol}] deep orphan recovery after after() failure:`,
          recoverErr,
        );
      }
    });
  });
}

/** Best-effort KV counters — must never affect Scan latency or success. */
function scheduleScanAnalytics(address: string) {
  after(() => {
    scheduleSuccessfulScanAnalytics(address);
  });
}

export async function GET(request: Request) {
  try {
    bindAndAssertDeploymentScope(request);
    const { searchParams } = new URL(request.url);
    const address = (searchParams.get("address") ?? HANSOME_TOKEN).trim();
    const refresh = parseRefreshFlag(searchParams);
    const forceLp =
      searchParams.get("forceLp") === "1" ||
      searchParams.get("forceLp") === "true";
    const result = await getCachedScan(address, {
      refresh,
      clientIp: clientIp(request),
      forceLpFullRefresh: forceLp,
    });
    scheduleAfterDeep(address, result);
    scheduleScanAnalytics(address);
    const deploymentScope =
      result.cache.deploymentScope ?? resolveDeploymentScope();
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Scan-Cache": result.cache.source,
        "X-Scan-Cache-Hit": result.cache.hit ? "1" : "0",
        "X-Scan-Cache-Stale": result.cache.stale ? "1" : "0",
        "X-Scan-KV": result.cache.kvConfigured ? "1" : "0",
        "X-Scan-Phase": result.analysisPhase ?? "complete",
        "X-Scan-Status": result.analysisStatus ?? "complete",
        "X-Scan-Deployment-Scope": deploymentScope,
      },
    });
  } catch (error) {
    if (error instanceof DeploymentScopeIsolationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error(`[${PROJECT.symbol}] /api/scan failed:`, error);
    const status = httpStatusForScanError(error);
    return NextResponse.json(scanErrorJson(error), {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export async function POST(request: Request) {
  try {
    bindAndAssertDeploymentScope(request);
    const body = (await request.json().catch(() => ({}))) as {
      address?: string;
      refresh?: boolean;
    };
    const { searchParams } = new URL(request.url);
    const address = (body.address ?? HANSOME_TOKEN).trim();
    const refresh = parseRefreshFlag(searchParams, Boolean(body.refresh));
    const result = await getCachedScan(address, {
      refresh,
      clientIp: clientIp(request),
    });
    scheduleAfterDeep(address, result);
    scheduleScanAnalytics(address);
    const deploymentScope =
      result.cache.deploymentScope ?? resolveDeploymentScope();
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Scan-Cache": result.cache.source,
        "X-Scan-Cache-Hit": result.cache.hit ? "1" : "0",
        "X-Scan-Cache-Stale": result.cache.stale ? "1" : "0",
        "X-Scan-KV": result.cache.kvConfigured ? "1" : "0",
        "X-Scan-Phase": result.analysisPhase ?? "complete",
        "X-Scan-Status": result.analysisStatus ?? "complete",
        "X-Scan-Deployment-Scope": deploymentScope,
      },
    });
  } catch (error) {
    if (error instanceof DeploymentScopeIsolationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error(`[${PROJECT.symbol}] /api/scan POST failed:`, error);
    const status = httpStatusForScanError(error);
    return NextResponse.json(scanErrorJson(error), {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
