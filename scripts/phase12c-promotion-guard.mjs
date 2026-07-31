#!/usr/bin/env node
/**
 * Phase 12C — Release/promotion guard.
 *
 * Aborts if candidate deploymentScope == production (or equals production tip scope).
 * Never promotes www / apex / game — this script only validates isolation.
 *
 * Usage:
 *   node scripts/phase12c-promotion-guard.mjs --candidate-url <url> [--production-url https://www.hansomealpacas.xyz]
 *
 * Exit 0 = isolated OK (still does NOT promote)
 * Exit 2 = PROMOTION_ABORT (shared scope)
 * Exit 1 = other failure
 */

import { spawnSync } from "node:child_process";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const candidateUrl = arg("--candidate-url");
const productionUrl = arg(
  "--production-url",
  "https://www.hansomealpacas.xyz",
);

if (!candidateUrl) {
  console.error(
    "Usage: node scripts/phase12c-promotion-guard.mjs --candidate-url <url>",
  );
  process.exit(1);
}

function fetchHealth(url) {
  const healthUrl = url.replace(/\/$/, "") + "/api/scan/health";
  const r = spawnSync(
    "npx",
    ["vercel", "curl", healthUrl, "--yes"],
    { encoding: "utf8", shell: true },
  );
  const out = (r.stdout || "") + (r.stderr || "");
  // Prefer JSON body from curl output
  const jsonMatch = out.match(/\{[\s\S]*"deploymentScope"[\s\S]*\}/);
  if (!jsonMatch) {
    // Fallback: plain fetch via vercel curl may print body alone
    try {
      return JSON.parse(out.trim().split("\n").filter(Boolean).pop());
    } catch {
      throw new Error(`Failed to parse health from ${healthUrl}:\n${out}`);
    }
  }
  return JSON.parse(jsonMatch[0]);
}

function assertIsolated(candidateScope, productionScope = "production") {
  if (
    !candidateScope ||
    candidateScope === productionScope ||
    candidateScope === "production"
  ) {
    const err = new Error(
      `PROMOTION_ABORT: candidate scope "${candidateScope}" equals or is production scope "${productionScope}".`,
    );
    err.code = "PROMOTION_SCOPE_GUARD";
    throw err;
  }
  if (
    !candidateScope.startsWith("candidate:") &&
    !candidateScope.startsWith("preview:")
  ) {
    const err = new Error(
      `PROMOTION_ABORT: candidate scope "${candidateScope}" is not candidate:* or preview:*.`,
    );
    err.code = "PROMOTION_SCOPE_GUARD";
    throw err;
  }
}

try {
  console.log("[phase12c-guard] candidate:", candidateUrl);
  console.log("[phase12c-guard] production:", productionUrl);

  const cand = fetchHealth(candidateUrl);
  let prodScope = "production";
  try {
    const prod = fetchHealth(productionUrl);
    prodScope = prod.deploymentScope || "production";
    console.log("[phase12c-guard] production health:", {
      deploymentId: prod.deploymentId,
      deploymentScope: prod.deploymentScope,
      cacheNamespace: prod.cacheNamespace,
      isProductionAlias: prod.isProductionAlias,
    });
  } catch (e) {
    console.warn(
      "[phase12c-guard] production health unavailable (using literal production):",
      e.message,
    );
  }

  console.log("[phase12c-guard] candidate health:", {
    deploymentId: cand.deploymentId,
    deploymentScope: cand.deploymentScope,
    cacheNamespace: cand.cacheNamespace,
    isProductionAlias: cand.isProductionAlias,
  });

  assertIsolated(cand.deploymentScope, prodScope);

  if (cand.cacheNamespace === prodScope) {
    throw Object.assign(
      new Error(
        `PROMOTION_ABORT: cacheNamespace "${cand.cacheNamespace}" equals production.`,
      ),
      { code: "PROMOTION_SCOPE_GUARD" },
    );
  }

  console.log(
    "[phase12c-guard] PASS — scopes isolated. DO NOT promote (guard only).",
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        candidateScope: cand.deploymentScope,
        productionScope: prodScope,
        candidateId: cand.deploymentId,
        promote: false,
      },
      null,
      2,
    ),
  );
  process.exit(0);
} catch (e) {
  console.error("[phase12c-guard] FAIL:", e.message);
  process.exit(e.code === "PROMOTION_SCOPE_GUARD" ? 2 : 1);
}
