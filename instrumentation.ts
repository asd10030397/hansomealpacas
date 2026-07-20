/**
 * Next.js server startup hook — validate Testnet gasless Production config.
 * Never prints secret values.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { reportGaslessProductionConfig } = await import(
    "@/lib/game/server/gaslessProductionConfig"
  );
  reportGaslessProductionConfig();
}
