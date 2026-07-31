/**
 * Phase 10C-4 / 12C — deployment-scoped scan cache isolation.
 *
 * Scopes:
 *   production              → live production aliases only
 *   candidate:{deploymentId}→ --prod --skip-domain (or production-target) soak
 *   preview:{deploymentId}  → Vercel Preview deployments
 *   local                   → local / unset development
 *
 * CRITICAL (Phase 12C): NEVER grant `production` merely because
 * `vercel deploy --prod` was used. Production env
 * `HANSOME_SCAN_DEPLOYMENT_SCOPE=production` is ignored unless the request
 * host is a production alias. Deployment URLs (*.vercel.app) are never
 * production scope.
 *
 * Does not change score / lock / Pons / Hook algorithms.
 */

export type DeploymentScope = string;

/** Semantic schema for scoped LP publish bodies (reject pre-10C-4). */
export const LP_RESULT_SCHEMA_VERSION = 1;

/** Env override for explicit scope (tests / forced islands). */
const SCOPE_ENV = "HANSOME_SCAN_DEPLOYMENT_SCOPE";

/** Hosts that alone may use deploymentScope=production. */
export const PRODUCTION_ALIAS_HOSTS = [
  "www.hansomealpacas.xyz",
  "hansomealpacas.xyz",
  "game.hansomealpacas.xyz",
] as const;

export class DeploymentScopeIsolationError extends Error {
  readonly code = "DEPLOYMENT_SCOPE_ISOLATION" as const;

  constructor(message: string) {
    super(message);
    this.name = "DeploymentScopeIsolationError";
  }
}

export class PromotionScopeGuardError extends Error {
  readonly code = "PROMOTION_SCOPE_GUARD" as const;

  constructor(message: string) {
    super(message);
    this.name = "PromotionScopeGuardError";
  }
}

let testOverride: DeploymentScope | null = null;

type RequestScopeContext = {
  /** Normalized request host (no port), or null when unbound. */
  host: string | null;
  /** Cached resolve for this bind (cleared on re-bind). */
  cachedScope: DeploymentScope | null;
};

let requestContext: RequestScopeContext = {
  host: null,
  cachedScope: null,
};

export function sanitizeScopeSegment(raw: string): string {
  const s = raw.trim();
  if (!s) return "local";
  return s
    .replace(/[/\\]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

export function normalizeRequestHost(
  host: string | null | undefined,
): string | null {
  if (host == null) return null;
  const raw = String(host).trim().toLowerCase();
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim() ?? "";
  const noPort = first.includes(":") ? first.split(":")[0]! : first;
  return noPort || null;
}

export function isProductionAliasHost(
  host: string | null | undefined,
): boolean {
  const h = normalizeRequestHost(host);
  if (!h) return false;
  return (PRODUCTION_ALIAS_HOSTS as readonly string[]).includes(h);
}

export function extractRequestHost(request: {
  headers: { get(name: string): string | null };
  url?: string;
}): string | null {
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) return normalizeRequestHost(forwarded);
  const host = request.headers.get("host");
  if (host) return normalizeRequestHost(host);
  if (request.url) {
    try {
      return normalizeRequestHost(new URL(request.url).host);
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Bind request host for scope resolution + workers in the same invocation.
 * Call at the start of every Scan/analytics API handler (and health).
 */
export function bindDeploymentRequestHost(
  host: string | null | undefined,
): void {
  requestContext = {
    host: normalizeRequestHost(host),
    cachedScope: null,
  };
}

export function getBoundDeploymentRequestHost(): string | null {
  return requestContext.host;
}

/** Test / after-handler cleanup. */
export function clearDeploymentRequestContext(): void {
  requestContext = { host: null, cachedScope: null };
}

function vercelDeploymentId(): string {
  return (
    process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID?.trim() ||
    ""
  );
}

function vercelEnv(): string {
  return (process.env.VERCEL_ENV ?? "").trim().toLowerCase();
}

/**
 * Resolve cache deployment scope for this process / request.
 *
 * Priority:
 * 1. Test override
 * 2. Explicit HANSOME_SCAN_DEPLOYMENT_SCOPE
 *    - bare `production` is ONLY honored when host is a production alias
 *      (fixes --prod --skip-domain inheriting Production env)
 * 3. Deployment metadata / Preview / Development
 * 4. Production alias host ONLY → production
 * 5. Fallback: local (never silent production)
 */
export function resolveDeploymentScope(): DeploymentScope {
  if (testOverride != null) return testOverride;
  if (requestContext.cachedScope != null) return requestContext.cachedScope;

  const host = requestContext.host;
  const scope = resolveDeploymentScopeUncached(host);
  requestContext.cachedScope = scope;
  return scope;
}

function resolveDeploymentScopeUncached(host: string | null): DeploymentScope {
  const explicit = process.env[SCOPE_ENV]?.trim();
  if (explicit) {
    const sanitized = sanitizeScopeSegment(explicit);
    if (sanitized === "production") {
      // Explicit production is host-gated — never inherit from --prod alone.
      if (isProductionAliasHost(host)) return "production";
      // Fall through to auto isolation for skip-domain / preview / local.
    } else {
      return sanitized;
    }
  }

  // Production aliases always use the stable production namespace.
  if (isProductionAliasHost(host)) return "production";

  const dpl = vercelDeploymentId();
  const env = vercelEnv();

  if (env === "preview") {
    if (dpl) return sanitizeScopeSegment(`preview:${dpl}`);
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
    if (commit) return sanitizeScopeSegment(`preview:${commit.slice(0, 12)}`);
    return "preview:unknown";
  }

  if (env === "development" || process.env.NODE_ENV === "development") {
    if (dpl) return sanitizeScopeSegment(`local:${dpl}`);
    return "local";
  }

  // Vercel production *target* (includes --prod --skip-domain) without alias host:
  // isolate as candidate — NEVER production.
  if (dpl) return sanitizeScopeSegment(`candidate:${dpl}`);

  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (commit) return sanitizeScopeSegment(`candidate:${commit.slice(0, 12)}`);

  // Offline / unknown — prefer local over silent production sharing.
  return "local";
}

/**
 * Runtime assertion: production scope is forbidden off production aliases.
 * Throws DeploymentScopeIsolationError — callers must not continue.
 */
export function assertProductionScopeHostSafety(
  scope: DeploymentScope = resolveDeploymentScope(),
  host: string | null = requestContext.host,
): void {
  if (scope === "production" && !isProductionAliasHost(host)) {
    throw new DeploymentScopeIsolationError(
      `deploymentScope=production is forbidden for host=${host ?? "(none)"}; ` +
        `allowed hosts: ${PRODUCTION_ALIAS_HOSTS.join(", ")}. ` +
        `Deployment URLs (*.vercel.app) never use production scope.`,
    );
  }
}

/**
 * Bind host from Request, resolve scope, assert safety. Returns scope.
 */
export function bindAndAssertDeploymentScope(request: {
  headers: { get(name: string): string | null };
  url?: string;
}): DeploymentScope {
  bindDeploymentRequestHost(extractRequestHost(request));
  const scope = resolveDeploymentScope();
  assertProductionScopeHostSafety(scope, getBoundDeploymentRequestHost());
  return scope;
}

export function isProductionDeploymentScope(scope: DeploymentScope): boolean {
  return scope === "production";
}

export function isCandidateDeploymentScope(scope: DeploymentScope): boolean {
  return scope.startsWith("candidate:") || scope.startsWith("candidate_");
}

export function isPreviewDeploymentScope(scope: DeploymentScope): boolean {
  return scope.startsWith("preview:") || scope.startsWith("preview_");
}

export function isLocalDeploymentScope(scope: DeploymentScope): boolean {
  return scope === "local" || scope.startsWith("local:");
}

/** Test helper — null clears override. */
export function setDeploymentScopeForTests(
  scope: DeploymentScope | null,
): void {
  testOverride = scope;
  requestContext.cachedScope = null;
}

/**
 * Phase 12C — every durable KV key begins with deploymentScope.
 * Form: {deploymentScope}:{...parts}
 */
export function scopedKvKey(...parts: Array<string | number>): string {
  return [resolveDeploymentScope(), ...parts.map(String)].join(":");
}

/** Cache namespace identity (= deployment scope). */
export function getCacheNamespace(
  scope: DeploymentScope = resolveDeploymentScope(),
): string {
  return scope;
}

/**
 * Build scoped KV key suffix (legacy 10C-4 helper): {scope}:{chainId}:{tokenLower}
 *
 * Note: scope may contain ":" (e.g. candidate:dpl_xxx). Consumers that need
 * family insertion must peel chainId+token from the END (see peelScopedTokenKey).
 */
export function scopedTokenKey(
  scope: DeploymentScope,
  chainId: number,
  tokenAddress: string,
): string {
  return `${sanitizeScopeSegment(scope)}:${chainId}:${tokenAddress.toLowerCase()}`;
}

/** Peel `{scope}:{chainId}:{token}` where scope may contain ":". */
export function peelScopedTokenKey(scopedKey: string): {
  scope: string;
  chainId: string;
  token: string;
} | null {
  const parts = scopedKey.split(":");
  if (parts.length < 3) return null;
  const token = parts[parts.length - 1]!;
  const chainId = parts[parts.length - 2]!;
  const scope = parts.slice(0, -2).join(":");
  if (!scope || !chainId || !token) return null;
  return { scope, chainId, token };
}

/** Phase 12C form: {scope}:scan:snapshot:{chainId}:{token} */
export function scanSnapshotKvKey(scopedKey: string): string {
  const peeled = peelScopedTokenKey(scopedKey);
  if (!peeled) return scopedKvKey("scan", "snapshot", scopedKey);
  return `${peeled.scope}:scan:snapshot:${peeled.chainId}:${peeled.token}`;
}

export function scanMetaKvKey(scopedKey: string): string {
  const peeled = peelScopedTokenKey(scopedKey);
  if (!peeled) return scopedKvKey("scan", "meta", scopedKey);
  return `${peeled.scope}:scan:meta:${peeled.chainId}:${peeled.token}`;
}

export function scanLockKvKey(scopedKey: string): string {
  const peeled = peelScopedTokenKey(scopedKey);
  if (!peeled) return scopedKvKey("scan", "lock", scopedKey);
  return `${peeled.scope}:scan:lock:${peeled.chainId}:${peeled.token}`;
}

export function scanLpResultKvKey(scopedKey: string): string {
  const peeled = peelScopedTokenKey(scopedKey);
  if (!peeled) return scopedKvKey("scan", "lp", "result", scopedKey);
  return `${peeled.scope}:scan:lp:result:${peeled.chainId}:${peeled.token}`;
}

/** Rate-limit keys are also deployment-scoped (Phase 12C). */
export function scanRlAddrKvKey(addrKey: string): string {
  return scopedKvKey("scan", "rl", "addr", addrKey);
}

export function scanRlIpKvKey(hash: string): string {
  return scopedKvKey("scan", "rl", "ip", hash);
}

/**
 * Promotion guard: abort if candidate scope equals / is production.
 * Candidate must never share the production namespace.
 */
export function assertPromotionScopesIsolated(
  candidateScope: DeploymentScope,
  productionScope: DeploymentScope = "production",
): void {
  const c = sanitizeScopeSegment(candidateScope);
  const p = sanitizeScopeSegment(productionScope);
  if (c === p || c === "production" || isProductionDeploymentScope(c)) {
    throw new PromotionScopeGuardError(
      `PROMOTION_ABORT: candidate scope "${c}" equals or is production scope "${p}". ` +
        `Redeploy candidate with isolated candidate:{deploymentId} or preview:{deploymentId}.`,
    );
  }
  if (!isCandidateDeploymentScope(c) && !isPreviewDeploymentScope(c)) {
    throw new PromotionScopeGuardError(
      `PROMOTION_ABORT: candidate scope "${c}" is not candidate:* or preview:*.`,
    );
  }
}

export type DeploymentHealthInfo = {
  deploymentId: string | null;
  deploymentScope: DeploymentScope;
  environment: string;
  isProductionAlias: boolean;
  buildId: string | null;
  gitCommit: string | null;
  cacheNamespace: string;
  vercelEnv: string | null;
  boundHost: string | null;
  productionAliasHosts: readonly string[];
};

export function getDeploymentHealthInfo(
  host: string | null = requestContext.host,
): DeploymentHealthInfo {
  const boundHost = normalizeRequestHost(host) ?? requestContext.host;
  if (boundHost !== requestContext.host) {
    bindDeploymentRequestHost(boundHost);
  }
  const deploymentScope = resolveDeploymentScope();
  const dpl = vercelDeploymentId() || null;
  return {
    deploymentId: dpl,
    deploymentScope,
    environment: vercelEnv() || process.env.NODE_ENV || "unknown",
    isProductionAlias: isProductionAliasHost(boundHost),
    buildId:
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
      process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
      process.env.BUILD_ID?.trim() ||
      null,
    gitCommit:
      process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
      null,
    cacheNamespace: getCacheNamespace(deploymentScope),
    vercelEnv: vercelEnv() || null,
    boundHost,
    productionAliasHosts: PRODUCTION_ALIAS_HOSTS,
  };
}
