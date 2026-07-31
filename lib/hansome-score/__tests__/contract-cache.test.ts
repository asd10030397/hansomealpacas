import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTRACT_CACHE_ANALYZER_VERSION,
  CONTRACT_CACHE_SCHEMA_VERSION,
  bundleContainsForbiddenMutableFields,
  clearContractCacheMemoryForTests,
  clearContractCacheTestKv,
  contractCacheKey,
  deriveProxyHeuristic,
  getContractCacheStats,
  hashBytecode,
  persistContractAnalysisBundle,
  resetContractCacheStatsForTests,
  resolveContractStaticAfterBytecode,
  resolveContractStaticArtifacts,
  sanitizeContractAnalysisBundle,
  useContractCacheTestKv,
  type ContractAnalysisBundle,
} from "@/lib/hansome-score/contract-cache";
import { analyzeContractRisk } from "@/lib/hansome-score/contract-risk";

const CHAIN = 4663;
const ADDR = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";
const OTHER = "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1";
const BYTECODE = "0x608060405234801561001057600080fd5b50";
const BYTECODE_B = "0x6080604052600080fd";

vi.mock("@/lib/hansome-score/rpc", () => ({
  readBytecode: vi.fn(async () => BYTECODE),
}));

vi.mock("@/lib/hansome-score/blockscout", () => ({
  fetchBlockscoutSmartContract: vi.fn(async () => ({
    isVerified: true,
    abi: [
      { type: "function", name: "transfer", inputs: [] },
      { type: "function", name: "implementation", inputs: [] },
    ],
    sourceCode: "contract Foo is UUPSUpgradeable {}",
    fullSourceCode: "contract Foo is UUPSUpgradeable {}",
    name: "Foo",
  })),
  fetchBlockscoutVerified: vi.fn(async () => true),
}));

import { readBytecode } from "@/lib/hansome-score/rpc";
import {
  fetchBlockscoutSmartContract,
  fetchBlockscoutVerified,
} from "@/lib/hansome-score/blockscout";

const readBc = vi.mocked(readBytecode);
const fetchSmart = vi.mocked(fetchBlockscoutSmartContract);
const fetchVer = vi.mocked(fetchBlockscoutVerified);

function sampleBundle(
  overrides: Partial<ContractAnalysisBundle> = {},
): ContractAnalysisBundle {
  const abi = [
    { type: "function", name: "transfer" },
    { type: "function", name: "implementation" },
  ];
  const sourceCode = "contract Foo is UUPSUpgradeable {}";
  return {
    schemaVersion: CONTRACT_CACHE_SCHEMA_VERSION,
    analyzerVersion: CONTRACT_CACHE_ANALYZER_VERSION,
    chainId: CHAIN,
    address: ADDR.toLowerCase(),
    bytecodeHash: hashBytecode(BYTECODE),
    runtimeBytecode: BYTECODE,
    isVerified: true,
    abi,
    sourceCode,
    fullSourceCode: sourceCode,
    contractName: "Foo",
    proxy: deriveProxyHeuristic(abi, sourceCode),
    artifactsComplete: true,
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("contract-cache Phase 3", () => {
  let kv: Map<string, unknown>;

  beforeEach(() => {
    clearContractCacheMemoryForTests();
    clearContractCacheTestKv();
    resetContractCacheStatsForTests();
    kv = new Map();
    useContractCacheTestKv(kv);
    readBc.mockReset();
    fetchSmart.mockReset();
    fetchVer.mockReset();
    readBc.mockResolvedValue(BYTECODE);
    fetchSmart.mockResolvedValue({
      isVerified: true,
      abi: [
        { type: "function", name: "transfer", inputs: [] },
        { type: "function", name: "implementation", inputs: [] },
      ],
      sourceCode: "contract Foo is UUPSUpgradeable {}",
      fullSourceCode: "contract Foo is UUPSUpgradeable {}",
      name: "Foo",
    });
    fetchVer.mockResolvedValue(true);
  });

  afterEach(() => {
    clearContractCacheMemoryForTests();
    clearContractCacheTestKv();
  });

  it("1. runtime bytecode hit (hash-keyed bundle)", async () => {
    await persistContractAnalysisBundle(sampleBundle());
    clearContractCacheMemoryForTests();
    const r = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    expect(r.state).toBe("hit");
    expect(r.explorerAvoided).toBe(true);
    expect(fetchSmart).not.toHaveBeenCalled();
  });

  it("2. miss and populate", async () => {
    const r = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    expect(r.state).toBe("miss");
    expect(fetchSmart).toHaveBeenCalledTimes(1);
    const again = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    expect(again.state).toBe("hit");
    expect(fetchSmart).toHaveBeenCalledTimes(1);
  });

  it("3. schema-version mismatch → miss/stale", () => {
    const raw = { ...sampleBundle(), schemaVersion: 999 };
    expect(
      sanitizeContractAnalysisBundle(raw, {
        chainId: CHAIN,
        address: ADDR,
        bytecodeHash: hashBytecode(BYTECODE),
      }),
    ).toBeNull();
  });

  it("4. analyzer-version mismatch → miss/stale", () => {
    const raw = { ...sampleBundle(), analyzerVersion: "old-analyzer" };
    expect(
      sanitizeContractAnalysisBundle(raw, {
        chainId: CHAIN,
        address: ADDR,
        bytecodeHash: hashBytecode(BYTECODE),
      }),
    ).toBeNull();
  });

  it("5. corrupt recovery", async () => {
    const key = contractCacheKey({
      chainId: CHAIN,
      address: ADDR,
      artifactType: "analysis_bundle",
      bytecodeHash: hashBytecode(BYTECODE),
    });
    kv.set(key, { totally: "broken" });
    const r = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    expect(["rebuilding", "miss"]).toContain(r.state);
    expect(fetchSmart).toHaveBeenCalled();
    expect(getContractCacheStats().corrupt).toBeGreaterThan(0);
  });

  it("6. RPC failure no poison", async () => {
    const r = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: null,
      chainId: CHAIN,
    });
    expect(r.bytecode).toBeNull();
    // No positive persist without bytecode hash.
    expect(
      [...kv.keys()].some((k) => k.includes(hashBytecode(BYTECODE))),
    ).toBe(false);
  });

  it("7. short-lived negative cache", async () => {
    fetchSmart.mockResolvedValue({
      isVerified: false,
      abi: null,
      sourceCode: null,
      fullSourceCode: null,
      name: null,
    });
    fetchVer.mockResolvedValue(false);
    const r = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    expect(r.bundle?.negative).toBe(true);
    expect(r.bundle?.artifactsComplete).toBe(false);
  });

  it("8. verified ABI cache", async () => {
    await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    fetchSmart.mockClear();
    const hit = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    expect(hit.smart?.abi).toBeTruthy();
    expect(hit.smart?.isVerified).toBe(true);
    expect(fetchSmart).not.toHaveBeenCalled();
  });

  it("9. proxy resolved cached", async () => {
    const r = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    expect(r.bundle?.proxy.resolved).toBe(true);
    expect(r.bundle?.proxy.isProxy).toBe(true);
  });

  it("10. proxy unresolved remains Unknown", () => {
    const p = deriveProxyHeuristic(null, null);
    expect(p.isProxy).toBeNull();
    expect(p.resolved).toBe(false);
    const sanitized = sanitizeContractAnalysisBundle(
      sampleBundle({
        abi: null,
        sourceCode: null,
        artifactsComplete: false,
        proxy: { isProxy: false, implementationAddress: null, resolved: false },
      }),
      { chainId: CHAIN, address: ADDR, bytecodeHash: hashBytecode(BYTECODE) },
    );
    expect(sanitized?.proxy.isProxy).toBeNull();
  });

  it("11. proxy implementation / bytecode change invalidates", async () => {
    await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    fetchSmart.mockClear();
    fetchSmart.mockResolvedValue({
      isVerified: true,
      abi: [{ type: "function", name: "transfer" }],
      sourceCode: "contract Bar {}",
      fullSourceCode: "contract Bar {}",
      name: "Bar",
    });
    const r = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE_B,
      chainId: CHAIN,
    });
    expect(r.state).toBe("miss");
    expect(fetchSmart).toHaveBeenCalled();
    expect(r.bundle?.bytecodeHash).toBe(hashBytecode(BYTECODE_B));
  });

  it("12. concurrent dedupe", async () => {
    const a = resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    const b = resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    await Promise.all([a, b]);
    expect(getContractCacheStats().concurrentDeduped).toBeGreaterThan(0);
    expect(fetchSmart.mock.calls.length).toBe(1);
  });

  it("13. cross-chain key isolation", () => {
    const a = contractCacheKey({
      chainId: 4663,
      address: ADDR,
      artifactType: "analysis_bundle",
      bytecodeHash: "abc",
    });
    const b = contractCacheKey({
      chainId: 1,
      address: ADDR,
      artifactType: "analysis_bundle",
      bytecodeHash: "abc",
    });
    expect(a).not.toBe(b);
  });

  it("14. address normalization", () => {
    const a = contractCacheKey({
      chainId: CHAIN,
      address: ADDR.toUpperCase(),
      artifactType: "analysis_bundle",
      bytecodeHash: "x",
    });
    const b = contractCacheKey({
      chainId: CHAIN,
      address: ADDR.toLowerCase(),
      artifactType: "analysis_bundle",
      bytecodeHash: "x",
    });
    expect(a).toBe(b);
  });

  it("15. cached vs uncached semantic equivalence", async () => {
    const miss = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    const hit = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    const bypass = await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
      bypass: true,
    });
    const riskHit = analyzeContractRisk({
      verified: hit.smart!.isVerified,
      abi: hit.smart!.abi as never,
      sourceCode: hit.smart!.sourceCode,
      goplus: null,
    });
    const riskBypass = analyzeContractRisk({
      verified: bypass.smart!.isVerified,
      abi: bypass.smart!.abi as never,
      sourceCode: bypass.smart!.sourceCode,
      goplus: null,
    });
    expect(riskHit.isProxy).toBe(riskBypass.isProxy);
    expect(riskHit.status).toBe(riskBypass.status);
    expect(riskHit.mintable).toBe(riskBypass.mintable);
    expect(miss.smart?.abi).toEqual(hit.smart?.abi);
  });

  it("16. cache unavailable fallback", async () => {
    useContractCacheTestKv(null);
    clearContractCacheMemoryForTests();
    const r = await resolveContractStaticArtifacts({
      tokenAddress: ADDR,
      chainId: CHAIN,
    });
    expect(r.smart).toBeTruthy();
    expect(fetchSmart).toHaveBeenCalled();
  });

  it("17. implementation bytecode isolation", async () => {
    await resolveContractStaticAfterBytecode({
      tokenAddress: ADDR,
      bytecode: BYTECODE,
      chainId: CHAIN,
    });
    const other = await resolveContractStaticAfterBytecode({
      tokenAddress: OTHER,
      bytecode: BYTECODE_B,
      chainId: CHAIN,
    });
    expect(other.bundle?.address).toBe(OTHER.toLowerCase());
    expect(other.bundle?.bytecodeHash).toBe(hashBytecode(BYTECODE_B));
  });

  it("18. no mutable holder/supply/liquidity in contract cache", () => {
    const b = sampleBundle();
    expect(bundleContainsForbiddenMutableFields(b)).toEqual([]);
  });
});
