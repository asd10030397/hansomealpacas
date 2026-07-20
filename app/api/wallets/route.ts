import { NextResponse } from "next/server";
import { PROJECT } from "@/content/project";
import { readOfficialWalletBalances } from "@/lib/wallet/balances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const balances = await readOfficialWalletBalances();
    return NextResponse.json(
      { updatedAt: new Date().toISOString(), balances },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(`[${PROJECT.symbol}] /api/wallets failed:`, error);
    const message =
      process.env.NODE_ENV === "production"
        ? "Failed to load wallet balances"
        : error instanceof Error
          ? error.message
          : "Failed to load wallet balances";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
