import { NextResponse } from "next/server";
import {
  bindAndAssertDeploymentScope,
  DeploymentScopeIsolationError,
  getDeploymentHealthInfo,
} from "@/lib/hansome-score/deployment-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Phase 12C — deployment isolation health / debug.
 * Returns deploymentId, deploymentScope, environment, isProductionAlias,
 * buildId, gitCommit, cacheNamespace.
 */
export async function GET(request: Request) {
  try {
    bindAndAssertDeploymentScope(request);
    const info = getDeploymentHealthInfo();
    return NextResponse.json(
      {
        ok: true,
        ...info,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Scan-Deployment-Scope": info.deploymentScope,
          "X-Scan-Cache-Namespace": info.cacheNamespace,
        },
      },
    );
  } catch (error) {
    if (error instanceof DeploymentScopeIsolationError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message,
        },
        {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    console.error("[scan/health] failed:", error);
    return NextResponse.json(
      { ok: false, error: "HEALTH_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
