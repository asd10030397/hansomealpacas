import { NextResponse } from "next/server";
import { bindAndAssertDeploymentScope } from "@/lib/hansome-score/deployment-scope";
import { isAuthorizedAdmin } from "@/lib/website-analytics/auth";
import { getDashboardStats } from "@/lib/website-analytics/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    bindAndAssertDeploymentScope(request);
    const stats = await getDashboardStats();
    if (!stats) {
      return NextResponse.json(
        { error: "Analytics storage unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Stats failed" }, { status: 500 });
  }
}
