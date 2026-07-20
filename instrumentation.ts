/**
 * Next.js server startup hook.
 * Node-only work lives in instrumentation.node.ts so Edge never sees node:crypto.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  await import("./instrumentation.node");
}
