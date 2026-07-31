import { NextResponse } from "next/server";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import { bindAndAssertDeploymentScope } from "@/lib/hansome-score/deployment-scope";
import { invalidateLpDiscoveryCacheForToken } from "@/lib/hansome-score/lp/position-cache";
import { invalidateScanSnapshotKeysForAddress } from "@/lib/hansome-score/scan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** FOX proof token — exact keys only; never a global flush. */
const FOX = "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1";
const CONFIRM = "FOX_DUST_MATERIALITY_2026_07_28";

/**
 * One-shot Production helper: delete FOX scan snapshot/meta/lock + LP discovery
 * keys after dust-materiality deploy. Transfer-index (`scan:xfer:*`) untouched.
 *
 * POST { "confirm": "FOX_DUST_MATERIALITY_2026_07_28" }
 */
export async function POST(req: Request) {
  bindAndAssertDeploymentScope(req);
  let body: { confirm?: string } = {};
  try {
    body = (await req.json()) as { confirm?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (body.confirm !== CONFIRM) {
    return NextResponse.json({ ok: false, error: "confirm_mismatch" }, { status: 403 });
  }

  const snap = await invalidateScanSnapshotKeysForAddress(FOX);
  const lp = await invalidateLpDiscoveryCacheForToken(SCAN_CHAIN_ID, FOX);

  return NextResponse.json({
    ok: true,
    token: FOX,
    transferIndexUntouched: true,
    globalFlush: false,
    snapshot: snap,
    lpDiscovery: lp,
    keys: [
      ...snap.deleted.map((d) => d.key),
      lp.key,
    ],
  });
}
