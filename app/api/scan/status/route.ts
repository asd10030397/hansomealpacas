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
  getScanAnalysisStatus,
} from "@/lib/hansome-score/scan-cache";
import {
  httpStatusForScanError,
  scanErrorJson,
} from "@/lib/hansome-score/scan-errors";
import { isScanComplete } from "@/lib/hansome-score/scan-fast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Status peek + deep nudge via after(). maxDuration must cover deep budget
 * (same ceiling as /api/scan) so progressive enrich can finish.
 */
export const maxDuration = 300;

/**
 * Poll deep-analysis progress without re-running Fast Scan.
 * Returns latest snapshot when available + stage flags.
 */
export async function GET(request: Request) {
  try {
    bindAndAssertDeploymentScope(request);
    const { searchParams } = new URL(request.url);
    const address = (searchParams.get("address") ?? HANSOME_TOKEN).trim();
    const status = await getScanAnalysisStatus(address);

    // Always use after() for deep work — fire-and-forget dies when the request ends.
    if (
      status.result &&
      !isScanComplete(status.result) &&
      status.needsDeepAfter
    ) {
      after(() => {
        void ensureDeepAnalysis(address).catch((err) => {
          console.warn(`[${PROJECT.symbol}] status after() deep failed:`, err);
        });
      });
    }

    const deploymentScope = resolveDeploymentScope();
    return NextResponse.json(
      {
        address: status.address,
        analysisStatus: status.analysisStatus,
        analysisPhase: status.analysisPhase,
        scoreProvisional: status.scoreProvisional,
        analysisStages: status.analysisStages,
        deepInflight: status.deepInflight,
        complete: status.result ? isScanComplete(status.result) : false,
        deploymentScope,
        result: status.result,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          "X-Scan-Status": status.analysisStatus ?? "unknown",
          "X-Scan-Deployment-Scope": deploymentScope,
        },
      },
    );
  } catch (error) {
    if (error instanceof DeploymentScopeIsolationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error(`[${PROJECT.symbol}] /api/scan/status failed:`, error);
    const status = httpStatusForScanError(error);
    return NextResponse.json(scanErrorJson(error), {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
