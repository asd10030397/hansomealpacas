/**
 * Phase 3 — Static contract-analysis cache.
 *
 * Caches immutable contract artifacts (bytecode, verified ABI/source, proxy heuristic
 * inputs). Never caches mutable token state (holders, supply, liquidity, locks).
 * Cache failure → degrade to uncached fetch; never fail the scan.
 */

import { createHash } from "node:crypto";
import { getAddress } from "viem";
import {
  fetchBlockscoutSmartContract,
  fetchBlockscoutVerified,
  type BlockscoutSmartContract,
} from "@/lib/hansome-score/blockscout";
import { SCAN_CHAIN_ID, SCORE_SPEC_VERSION } from "@/lib/hansome-score/constants";
import { scopedKvKey } from "@/lib/hansome-score/deployment-scope";
import { readBytecode } from "@/lib/hansome-score/rpc";

/** Bump when cache payload shape changes. */
export const CONTRACT_CACHE_SCHEMA_VERSION = 1;
/** Ties derived artifacts to analyzer compatibility (not score formula weights). */
export const CONTRACT_CACHE_ANALYZER_VERSION = `cr-${SCORE_SPEC_VERSION}`;

export const CONTRACT_CACHE_POSITIVE_TTL_SEC = 7 * 24 * 60 * 60;
/** Negative / incomplete / RPC-failure entries — short only. */
export const CONTRACT_CACHE_NEGATIVE_TTL_SEC = 60;
export const CONTRACT_CACHE_MAX_BYTES = 400 * 1024;

export type ContractCacheState =
  | "hit"
  | "miss"
  | "stale"
  | "incomplete"
  | "corrupt"
  | "rebuilding"
  | "bypassed";

export type ContractCacheArtifactType =
  | "runtime_bytecode"
  | "verified_abi_source"
  | "proxy_heuristic"
  | "analysis_bundle";

export type ContractProxyHeuristic = {
  /** Heuristic from ABI/source only — null means Unknown (unresolved). Never cache null as false. */
  isProxy: boolean | null;
  /** No on-chain impl resolution today — always null; reserved for future. */
  implementationAddress: string | null;
  resolved: boolean;
};

export type ContractAnalysisBundle = {
  schemaVersion: typeof CONTRACT_CACHE_SCHEMA_VERSION;
  analyzerVersion: string;
  chainId: number;
  address: string;
  bytecodeHash: string;
  runtimeBytecode: string;
  isVerified: boolean | null;
  abi: unknown[] | null;
  sourceCode: string | null;
  fullSourceCode: string | null;
  contractName: string | null;
  proxy: ContractProxyHeuristic;
  /** True only when verified + (abi or source) present. */
  artifactsComplete: boolean;
  updatedAt: number;
  /** Short-lived negative marker (RPC/explorer failure). */
  negative?: boolean;
};

export type ContractCacheLookupResult = {
  state: ContractCacheState;
  bundle: ContractAnalysisBundle | null;
  smart: BlockscoutSmartContract | null;
  verified: boolean | null;
  bytecode: string | null;
  explorerAvoided: boolean;
  rpcBytecodeAvoided: boolean;
};

export type ContractCacheStats = {
  hits: number;
  misses: number;
  stale: number;
  incomplete: number;
  corrupt: number;
  rebuilding: number;
  bypassed: number;
  explorerAvoided: number;
  rpcBytecodeAvoided: number;
  concurrentDeduped: number;
};

const stats: ContractCacheStats = {
  hits: 0,
  misses: 0,
  stale: 0,
  incomplete: 0,
  corrupt: 0,
  rebuilding: 0,
  bypassed: 0,
  explorerAvoided: 0,
  rpcBytecodeAvoided: 0,
  concurrentDeduped: 0,
};

type TestKv = Map<string, unknown>;
let testKv: TestKv | null = null;
const mem = new Map<string, ContractAnalysisBundle>();
const inflight = new Map<string, Promise<ContractCacheLookupResult>>();

function normalizeAddress(address: string): string {
  try {
    return getAddress(address).toLowerCase();
  } catch {
    return address.trim().toLowerCase();
  }
}

export function hashBytecode(bytecode: string): string {
  return createHash("sha256").update(bytecode.toLowerCase()).digest("hex");
}

export function contractCacheKey(params: {
  chainId: number;
  address: string;
  artifactType: ContractCacheArtifactType;
  bytecodeHash: string;
  schemaVersion?: number;
  analyzerVersion?: string;
}): string {
  const schema = params.schemaVersion ?? CONTRACT_CACHE_SCHEMA_VERSION;
  const analyzer = params.analyzerVersion ?? CONTRACT_CACHE_ANALYZER_VERSION;
  const addr = normalizeAddress(params.address);
  return scopedKvKey(
    "scan",
    "contract",
    params.chainId,
    addr,
    `v${schema}`,
    analyzer,
    params.artifactType,
    params.bytecodeHash,
  );
}

export function getContractCacheStats(): ContractCacheStats {
  return { ...stats };
}

export function resetContractCacheStatsForTests(): void {
  for (const k of Object.keys(stats) as (keyof ContractCacheStats)[]) {
    stats[k] = 0;
  }
}

export function useContractCacheTestKv(map: TestKv | null): void {
  testKv = map;
}

export function clearContractCacheMemoryForTests(): void {
  mem.clear();
  inflight.clear();
}

export function clearContractCacheTestKv(): void {
  testKv = null;
}

function isKvConfigured(): boolean {
  if (testKv) return true;
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    "";
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    "";
  return Boolean(url && token);
}

async function kvGet(key: string): Promise<unknown | null> {
  if (testKv) return testKv.has(key) ? testKv.get(key)! : null;
  if (!isKvConfigured()) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return (await kv.get<unknown>(key)) ?? null;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: unknown, ttlSec: number): Promise<boolean> {
  if (testKv) {
    testKv.set(key, value);
    return true;
  }
  if (!isKvConfigured()) return false;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(key, value, { ex: ttlSec });
    return true;
  } catch {
    return false;
  }
}

function estimateBytes(v: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(v), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** Proxy heuristic identical to contract-risk (ABI/source only). */
export function deriveProxyHeuristic(
  abi: unknown[] | null,
  sourceCode: string | null,
): ContractProxyHeuristic {
  if (!abi && !sourceCode) {
    return { isProxy: null, implementationAddress: null, resolved: false };
  }
  const names = new Set(
    (Array.isArray(abi) ? abi : [])
      .filter(
        (x): x is { type?: string; name?: string } =>
          !!x && typeof x === "object",
      )
      .filter((x) => x.type === "function" && typeof x.name === "string")
      .map((x) => x.name!.toLowerCase()),
  );
  const abiProxy =
    names.has("implementation") ||
    names.has("upgradeto") ||
    names.has("upgradetoandcall");
  const src = sourceCode
    ? sourceCode
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/.*$/gm, " ")
    : "";
  const sourceProxy =
    /UUPSUpgradeable|TransparentUpgradeableProxy|\bdelegatecall\b/i.test(src);
  return {
    isProxy: abiProxy || sourceProxy,
    implementationAddress: null,
    resolved: true,
  };
}

export function sanitizeContractAnalysisBundle(
  raw: unknown,
  expect: {
    chainId: number;
    address: string;
    bytecodeHash?: string;
  },
): ContractAnalysisBundle | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== CONTRACT_CACHE_SCHEMA_VERSION) return null;
  if (o.analyzerVersion !== CONTRACT_CACHE_ANALYZER_VERSION) return null;
  if (o.chainId !== expect.chainId) return null;
  const addr = normalizeAddress(String(o.address ?? ""));
  if (addr !== normalizeAddress(expect.address)) return null;
  if (typeof o.bytecodeHash !== "string" || !o.bytecodeHash) return null;
  if (expect.bytecodeHash && o.bytecodeHash !== expect.bytecodeHash) return null;
  if (typeof o.runtimeBytecode !== "string") return null;
  if (typeof o.updatedAt !== "number" || !Number.isFinite(o.updatedAt)) return null;

  const proxyRaw = o.proxy;
  let proxy: ContractProxyHeuristic = {
    isProxy: null,
    implementationAddress: null,
    resolved: false,
  };
  if (proxyRaw && typeof proxyRaw === "object" && !Array.isArray(proxyRaw)) {
    const p = proxyRaw as Record<string, unknown>;
    const isProxy =
      p.isProxy === true ? true : p.isProxy === false ? false : null;
    proxy = {
      isProxy,
      implementationAddress:
        typeof p.implementationAddress === "string"
          ? p.implementationAddress
          : null,
      resolved: p.resolved === true,
    };
  }

  // Never accept unresolved proxy cached as permanent false via corrupt flag combo.
  if (!proxy.resolved && proxy.isProxy === false) {
    proxy = { isProxy: null, implementationAddress: null, resolved: false };
  }

  return {
    schemaVersion: CONTRACT_CACHE_SCHEMA_VERSION,
    analyzerVersion: CONTRACT_CACHE_ANALYZER_VERSION,
    chainId: expect.chainId,
    address: addr,
    bytecodeHash: o.bytecodeHash,
    runtimeBytecode: o.runtimeBytecode,
    isVerified:
      o.isVerified === true ? true : o.isVerified === false ? false : null,
    abi: Array.isArray(o.abi) ? o.abi : null,
    sourceCode: typeof o.sourceCode === "string" ? o.sourceCode : null,
    fullSourceCode:
      typeof o.fullSourceCode === "string" ? o.fullSourceCode : null,
    contractName: typeof o.contractName === "string" ? o.contractName : null,
    proxy,
    artifactsComplete: o.artifactsComplete === true,
    updatedAt: o.updatedAt,
    negative: o.negative === true,
  };
}

function bundleToSmart(b: ContractAnalysisBundle): BlockscoutSmartContract {
  return {
    isVerified: b.isVerified === true,
    abi: b.abi,
    sourceCode: b.sourceCode,
    fullSourceCode: b.fullSourceCode,
    name: b.contractName,
  };
}

export async function persistContractAnalysisBundle(
  bundle: ContractAnalysisBundle,
): Promise<{ ok: boolean; reason?: string }> {
  if (estimateBytes(bundle) > CONTRACT_CACHE_MAX_BYTES) {
    return { ok: false, reason: "oversized" };
  }
  // Do not persist unresolved proxy as No.
  if (!bundle.proxy.resolved && bundle.proxy.isProxy === false) {
    bundle = {
      ...bundle,
      proxy: { isProxy: null, implementationAddress: null, resolved: false },
    };
  }
  // Never persist mutable fields — enforce allowlist shape via sanitize round-trip.
  const sanitized = sanitizeContractAnalysisBundle(bundle, {
    chainId: bundle.chainId,
    address: bundle.address,
    bytecodeHash: bundle.bytecodeHash,
  });
  if (!sanitized) return { ok: false, reason: "invalid" };

  const key = contractCacheKey({
    chainId: bundle.chainId,
    address: bundle.address,
    artifactType: "analysis_bundle",
    bytecodeHash: bundle.bytecodeHash,
  });
  const ttl = bundle.negative || !bundle.artifactsComplete
    ? CONTRACT_CACHE_NEGATIVE_TTL_SEC
    : CONTRACT_CACHE_POSITIVE_TTL_SEC;

  mem.set(`${bundle.chainId}:${bundle.address}`, sanitized);
  await kvSet(key, sanitized, ttl);
  // Tip key for address→hash lookup (same TTL class).
  const tipKey = scopedKvKey(
    "scan",
    "contract",
    "tip",
    bundle.chainId,
    bundle.address,
    `v${CONTRACT_CACHE_SCHEMA_VERSION}`,
    CONTRACT_CACHE_ANALYZER_VERSION,
  );
  await kvSet(
    tipKey,
    { bytecodeHash: bundle.bytecodeHash, updatedAt: bundle.updatedAt },
    ttl,
  );
  return { ok: true };
}

async function loadBundleByHash(
  chainId: number,
  address: string,
  bytecodeHash: string,
): Promise<{ state: ContractCacheState; bundle: ContractAnalysisBundle | null }> {
  const memKey = `${chainId}:${normalizeAddress(address)}`;
  const memHit = mem.get(memKey);
  if (memHit && memHit.bytecodeHash === bytecodeHash) {
    const s = sanitizeContractAnalysisBundle(memHit, {
      chainId,
      address,
      bytecodeHash,
    });
    if (!s) {
      stats.corrupt++;
      mem.delete(memKey);
      return { state: "corrupt", bundle: null };
    }
    if (s.negative) {
      stats.incomplete++;
      return { state: "incomplete", bundle: s };
    }
    stats.hits++;
    return { state: "hit", bundle: s };
  }

  const key = contractCacheKey({
    chainId,
    address,
    artifactType: "analysis_bundle",
    bytecodeHash,
  });
  const raw = await kvGet(key);
  if (raw == null) {
    stats.misses++;
    return { state: "miss", bundle: null };
  }
  const s = sanitizeContractAnalysisBundle(raw, {
    chainId,
    address,
    bytecodeHash,
  });
  if (!s) {
    stats.corrupt++;
    return { state: "corrupt", bundle: null };
  }
  if (s.analyzerVersion !== CONTRACT_CACHE_ANALYZER_VERSION) {
    stats.stale++;
    return { state: "stale", bundle: null };
  }
  mem.set(memKey, s);
  if (s.negative || !s.artifactsComplete) {
    stats.incomplete++;
    return { state: "incomplete", bundle: s };
  }
  stats.hits++;
  return { state: "hit", bundle: s };
}

/**
 * After bytecode is known: try cache, else fetch explorer + persist.
 * Caller should `readBytecode` in parallel with other Fast wave work when possible.
 */
export async function resolveContractStaticAfterBytecode(params: {
  tokenAddress: string;
  bytecode: string | null;
  chainId?: number;
  bypass?: boolean;
}): Promise<ContractCacheLookupResult> {
  const chainId = params.chainId ?? SCAN_CHAIN_ID;
  const address = normalizeAddress(params.tokenAddress);
  const inflightKey = `${chainId}:${address}:static`;

  if (params.bypass) {
    stats.bypassed++;
    const [smart, verified] = await Promise.all([
      fetchBlockscoutSmartContract(params.tokenAddress).catch(
        () => emptySmart(),
      ),
      fetchBlockscoutVerified(params.tokenAddress).catch(() => false),
    ]);
    return {
      state: "bypassed",
      bundle: null,
      smart,
      verified,
      bytecode: params.bytecode,
      explorerAvoided: false,
      rpcBytecodeAvoided: false,
    };
  }

  const existing = inflight.get(inflightKey);
  if (existing) {
    stats.concurrentDeduped++;
    return existing;
  }

  let resolveInflight!: (v: ContractCacheLookupResult) => void;
  const gate = new Promise<ContractCacheLookupResult>((resolve) => {
    resolveInflight = resolve;
  });
  inflight.set(inflightKey, gate);

  void (async () => {
    try {
      const bytecode = params.bytecode;
      if (bytecode == null) {
        stats.misses++;
        const [smart, verified] = await Promise.all([
          fetchBlockscoutSmartContract(params.tokenAddress).catch(() =>
            emptySmart(),
          ),
          fetchBlockscoutVerified(params.tokenAddress).catch(() => false),
        ]);
        resolveInflight({
          state: "miss",
          bundle: null,
          smart,
          verified,
          bytecode: null,
          explorerAvoided: false,
          rpcBytecodeAvoided: false,
        });
        return;
      }

      const bytecodeHash = hashBytecode(bytecode);
      const loaded = await loadBundleByHash(chainId, address, bytecodeHash);
      if (loaded.state === "hit" && loaded.bundle) {
        stats.explorerAvoided++;
        resolveInflight({
          state: "hit",
          bundle: loaded.bundle,
          smart: bundleToSmart(loaded.bundle),
          verified: loaded.bundle.isVerified,
          bytecode,
          explorerAvoided: true,
          rpcBytecodeAvoided: false,
        });
        return;
      }

      if (loaded.state === "corrupt" || loaded.state === "stale") {
        stats.rebuilding++;
      }

      const [smart, verified] = await Promise.all([
        fetchBlockscoutSmartContract(params.tokenAddress),
        fetchBlockscoutVerified(params.tokenAddress),
      ]);

      const isVerified = smart.isVerified || verified;
      const proxy = deriveProxyHeuristic(
        (smart.abi as unknown[] | null) ?? null,
        smart.sourceCode,
      );
      const artifactsComplete =
        isVerified === true && (!!smart.abi || !!smart.sourceCode);

      const bundle: ContractAnalysisBundle = {
        schemaVersion: CONTRACT_CACHE_SCHEMA_VERSION,
        analyzerVersion: CONTRACT_CACHE_ANALYZER_VERSION,
        chainId,
        address,
        bytecodeHash,
        runtimeBytecode:
          bytecode.length > 200_000 ? bytecode.slice(0, 200_000) : bytecode,
        isVerified,
        abi: (smart.abi as unknown[] | null) ?? null,
        sourceCode: smart.sourceCode,
        fullSourceCode: smart.fullSourceCode,
        contractName: smart.name,
        proxy,
        artifactsComplete,
        updatedAt: Date.now(),
        negative: !artifactsComplete,
      };

      try {
        await persistContractAnalysisBundle(bundle);
      } catch {
        /* degrade */
      }

      resolveInflight({
        state: loaded.state === "miss" ? "miss" : "rebuilding",
        bundle,
        smart,
        verified: isVerified,
        bytecode,
        explorerAvoided: false,
        rpcBytecodeAvoided: false,
      });
    } catch (err) {
      console.warn("[contract-cache] resolve failed, uncached fallback:", err);
      stats.bypassed++;
      resolveInflight(await uncachedFetch(address, chainId, "bypassed"));
    } finally {
      inflight.delete(inflightKey);
    }
  })();

  return gate;
}

function emptySmart(): BlockscoutSmartContract {
  return {
    isVerified: false,
    abi: null,
    sourceCode: null,
    fullSourceCode: null,
    name: null,
  };
}

/** Convenience: read bytecode then resolve (tests / simple callers). */
export async function resolveContractStaticArtifacts(params: {
  tokenAddress: string;
  chainId?: number;
  bypass?: boolean;
}): Promise<ContractCacheLookupResult> {
  if (params.bypass) {
    return resolveContractStaticAfterBytecode({
      tokenAddress: params.tokenAddress,
      bytecode: await readBytecode(params.tokenAddress).catch(() => null),
      chainId: params.chainId,
      bypass: true,
    });
  }
  const bytecode = await readBytecode(params.tokenAddress).catch(() => null);
  return resolveContractStaticAfterBytecode({
    tokenAddress: params.tokenAddress,
    bytecode,
    chainId: params.chainId,
  });
}

async function uncachedFetch(
  address: string,
  chainId: number,
  state: ContractCacheState,
): Promise<ContractCacheLookupResult> {
  const [bytecode, smart, verified] = await Promise.all([
    readBytecode(address).catch(() => null),
    fetchBlockscoutSmartContract(address).catch(
      () =>
        ({
          isVerified: false,
          abi: null,
          sourceCode: null,
          fullSourceCode: null,
          name: null,
        }) as BlockscoutSmartContract,
    ),
    fetchBlockscoutVerified(address).catch(() => false),
  ]);
  return {
    state,
    bundle: null,
    smart,
    verified,
    bytecode,
    explorerAvoided: false,
    rpcBytecodeAvoided: false,
  };
}

/**
 * Assert bundle has no mutable holder/supply/liquidity fields (test + audit helper).
 */
export function bundleContainsForbiddenMutableFields(
  bundle: ContractAnalysisBundle,
): string[] {
  const json = JSON.stringify(bundle);
  const forbidden = [
    "topHolders",
    "totalSupply",
    "poolManagerBalance",
    "lockDistribution",
    "knownBurned",
    "holderAdoption",
    "volume24h",
  ];
  return forbidden.filter((k) => json.includes(`"${k}"`));
}
