/**
 * Phase 12C — Deployment Isolation unit tests.
 * Release infrastructure only — no Hook/Score/LP/Ownership algorithm changes.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertProductionScopeHostSafety,
  assertPromotionScopesIsolated,
  bindDeploymentRequestHost,
  clearDeploymentRequestContext,
  DeploymentScopeIsolationError,
  getCacheNamespace,
  getDeploymentHealthInfo,
  isCandidateDeploymentScope,
  isPreviewDeploymentScope,
  isProductionAliasHost,
  peelScopedTokenKey,
  PRODUCTION_ALIAS_HOSTS,
  PromotionScopeGuardError,
  resolveDeploymentScope,
  scanSnapshotKvKey,
  scopedKvKey,
  scopedTokenKey,
  setDeploymentScopeForTests,
} from "@/lib/hansome-score/deployment-scope";
import { buildScopedHookPosIndexKey } from "@/lib/hansome-score/lp/hook-position-index/key";
import { buildV3PosIndexKey } from "@/lib/hansome-score/lp/v3-position-index/key";
import { transferIndexMetaKey } from "@/lib/hansome-score/transfer-index/keys";
import { lpDiscoveryKvKey } from "@/lib/hansome-score/lp/position-cache";
import { contractCacheKey } from "@/lib/hansome-score/contract-cache";
import { SCAN_ANALYTICS_KEYS } from "@/lib/scan-analytics";
import { WEB_ANALYTICS_KEYS } from "@/lib/website-analytics/keys";

const GME_POOL =
  "0x3623694d2613d7a543903b93226ed020d2fddbe00ed93ebd21aec098b10211c2";

const savedEnv: Record<string, string | undefined> = {};

function stashEnv(keys: string[]) {
  for (const k of keys) {
    savedEnv[k] = process.env[k];
  }
}

function restoreEnv(keys: string[]) {
  for (const k of keys) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
}

const ENV_KEYS = [
  "HANSOME_SCAN_DEPLOYMENT_SCOPE",
  "VERCEL_DEPLOYMENT_ID",
  "NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID",
  "VERCEL_ENV",
  "VERCEL_GIT_COMMIT_SHA",
  "NODE_ENV",
];

beforeEach(() => {
  stashEnv(ENV_KEYS);
  setDeploymentScopeForTests(null);
  clearDeploymentRequestContext();
  delete process.env.HANSOME_SCAN_DEPLOYMENT_SCOPE;
  delete process.env.VERCEL_DEPLOYMENT_ID;
  delete process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID;
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_GIT_COMMIT_SHA;
});

afterEach(() => {
  setDeploymentScopeForTests(null);
  clearDeploymentRequestContext();
  restoreEnv(ENV_KEYS);
});

describe("Phase 12C scope resolution", () => {
  it("Preview ≠ Candidate scopes", () => {
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_previewA";
    process.env.VERCEL_ENV = "preview";
    bindDeploymentRequestHost("hansomealpacas-abc.vercel.app");
    const preview = resolveDeploymentScope();
    expect(preview).toBe("preview:dpl_previewA");
    expect(isPreviewDeploymentScope(preview)).toBe(true);

    clearDeploymentRequestContext();
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_candB";
    bindDeploymentRequestHost("hansomealpacas-xyz.vercel.app");
    const candidate = resolveDeploymentScope();
    expect(candidate).toBe("candidate:dpl_candB");
    expect(isCandidateDeploymentScope(candidate)).toBe(true);
    expect(preview).not.toBe(candidate);
  });

  it("Candidate ≠ Production scopes", () => {
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_candC";
    process.env.VERCEL_ENV = "production";
    process.env.HANSOME_SCAN_DEPLOYMENT_SCOPE = "production"; // unsafe env
    bindDeploymentRequestHost("hansomealpacas-cand.vercel.app");
    const cand = resolveDeploymentScope();
    expect(cand).toBe("candidate:dpl_candC");
    expect(cand).not.toBe("production");

    clearDeploymentRequestContext();
    bindDeploymentRequestHost("www.hansomealpacas.xyz");
    expect(resolveDeploymentScope()).toBe("production");
  });

  it("Production == aliases only", () => {
    process.env.HANSOME_SCAN_DEPLOYMENT_SCOPE = "production";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_tip";

    for (const host of PRODUCTION_ALIAS_HOSTS) {
      clearDeploymentRequestContext();
      bindDeploymentRequestHost(host);
      expect(resolveDeploymentScope()).toBe("production");
      expect(isProductionAliasHost(host)).toBe(true);
    }
  });

  it("deployment URL never production scope (even with --prod env)", () => {
    process.env.HANSOME_SCAN_DEPLOYMENT_SCOPE = "production";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_skip_domain";
    bindDeploymentRequestHost("hansomealpacas-hp5h51664-the-67.vercel.app");
    expect(resolveDeploymentScope()).toBe("candidate:dpl_skip_domain");
    expect(resolveDeploymentScope()).not.toBe("production");
  });

  it("workers preserve scope via request bind (after() inheritance)", () => {
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_worker";
    process.env.VERCEL_ENV = "production";
    bindDeploymentRequestHost("hansomealpacas-worker.vercel.app");
    const scopeAtRequest = resolveDeploymentScope();
    // Simulate after() in same isolate — bound host/scope remains.
    expect(resolveDeploymentScope()).toBe(scopeAtRequest);
    expect(scopedKvKey("scan", "snapshot", 4663, "0xabc")).toContain(
      scopeAtRequest,
    );
    expect(scopedKvKey("scan", "snapshot", 4663, "0xabc").startsWith(scopeAtRequest)).toBe(
      true,
    );
  });
});

describe("Phase 12C KV namespaces", () => {
  it("KV namespaces differ across scopes", () => {
    setDeploymentScopeForTests("production");
    const prodSnap = scanSnapshotKvKey(
      scopedTokenKey("production", 4663, "0xAbC"),
    );
    const prodXfer = transferIndexMetaKey(4663, "0xAbC");
    const prodLp = lpDiscoveryKvKey(4663, "0xAbC");
    const prodHook = buildScopedHookPosIndexKey({
      scope: "production",
      chainId: 4663,
      poolId: GME_POOL,
    });
    const prodV3 = buildV3PosIndexKey({
      chainId: 4663,
      npm: "0x1111111111111111111111111111111111111111",
      token0: "0x2222222222222222222222222222222222222222",
      token1: "0x3333333333333333333333333333333333333333",
      fee: 3000,
    });
    const prodAnalytics = SCAN_ANALYTICS_KEYS.total();
    const prodWeb = WEB_ANALYTICS_KEYS.allPv();
    const prodContract = contractCacheKey({
      chainId: 4663,
      address: "0xAbC0000000000000000000000000000000000001",
      artifactType: "bytecode",
      bytecodeHash: "deadbeef",
    });

    setDeploymentScopeForTests("candidate:dpl_iso");
    const candSnap = scanSnapshotKvKey(
      scopedTokenKey("candidate:dpl_iso", 4663, "0xAbC"),
    );
    const candXfer = transferIndexMetaKey(4663, "0xAbC");
    const candLp = lpDiscoveryKvKey(4663, "0xAbC");
    const candHook = buildScopedHookPosIndexKey({
      scope: "candidate:dpl_iso",
      chainId: 4663,
      poolId: GME_POOL,
    });
    const candV3 = buildV3PosIndexKey({
      chainId: 4663,
      npm: "0x1111111111111111111111111111111111111111",
      token0: "0x2222222222222222222222222222222222222222",
      token1: "0x3333333333333333333333333333333333333333",
      fee: 3000,
    });
    const candAnalytics = SCAN_ANALYTICS_KEYS.total();
    const candWeb = WEB_ANALYTICS_KEYS.allPv();
    const candContract = contractCacheKey({
      chainId: 4663,
      address: "0xAbC0000000000000000000000000000000000001",
      artifactType: "bytecode",
      bytecodeHash: "deadbeef",
    });

    expect(prodSnap).not.toBe(candSnap);
    expect(prodXfer).not.toBe(candXfer);
    expect(prodLp).not.toBe(candLp);
    expect(prodHook).not.toBe(candHook);
    expect(prodV3).not.toBe(candV3);
    expect(prodAnalytics).not.toBe(candAnalytics);
    expect(prodWeb).not.toBe(candWeb);
    expect(prodContract).not.toBe(candContract);

    expect(prodSnap.startsWith("production:")).toBe(true);
    expect(candSnap.startsWith("candidate:dpl_iso:")).toBe(true);
    expect(candHook.startsWith("candidate:dpl_iso:")).toBe(true);
    expect(getCacheNamespace("candidate:dpl_iso")).not.toBe(
      getCacheNamespace("production"),
    );
  });

  it("peelScopedTokenKey handles colon-bearing scopes", () => {
    const k = scopedTokenKey("candidate:dpl_abc", 4663, "0xAbC");
    const peeled = peelScopedTokenKey(k);
    expect(peeled?.scope).toBe("candidate:dpl_abc");
    expect(peeled?.chainId).toBe("4663");
    expect(scanSnapshotKvKey(k)).toBe(
      "candidate:dpl_abc:scan:snapshot:4663:0xabc",
    );
  });
});

describe("Phase 12C promotion guard + runtime assertion", () => {
  it("promotion guard aborts shared / production candidate scope", () => {
    expect(() =>
      assertPromotionScopesIsolated("production", "production"),
    ).toThrow(PromotionScopeGuardError);
    expect(() =>
      assertPromotionScopesIsolated("candidate:dpl_x", "candidate:dpl_x"),
    ).toThrow(PromotionScopeGuardError);
    expect(() =>
      assertPromotionScopesIsolated("local", "production"),
    ).toThrow(PromotionScopeGuardError);
    expect(() =>
      assertPromotionScopesIsolated("candidate:dpl_ok", "production"),
    ).not.toThrow();
    expect(() =>
      assertPromotionScopesIsolated("preview:dpl_ok", "production"),
    ).not.toThrow();
  });

  it("runtime assertion fires for production scope off-alias", () => {
    expect(() =>
      assertProductionScopeHostSafety(
        "production",
        "hansomealpacas-foo.vercel.app",
      ),
    ).toThrow(DeploymentScopeIsolationError);

    expect(() =>
      assertProductionScopeHostSafety("production", "www.hansomealpacas.xyz"),
    ).not.toThrow();

    expect(() =>
      assertProductionScopeHostSafety(
        "candidate:dpl_x",
        "hansomealpacas-foo.vercel.app",
      ),
    ).not.toThrow();
  });

  it("health info exposes required fields", () => {
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_health";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_GIT_COMMIT_SHA = "abcdef1234567890";
    bindDeploymentRequestHost("hansomealpacas-health.vercel.app");
    const info = getDeploymentHealthInfo();
    expect(info.deploymentId).toBe("dpl_health");
    expect(info.deploymentScope).toBe("candidate:dpl_health");
    expect(info.isProductionAlias).toBe(false);
    expect(info.cacheNamespace).toBe("candidate:dpl_health");
    expect(info.gitCommit).toBe("abcdef1234567890");
    expect(info.environment).toBe("production");
  });
});
