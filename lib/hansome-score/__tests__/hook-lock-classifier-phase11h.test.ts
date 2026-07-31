import { describe, expect, it } from "vitest";
import {
  DEAD_ADDRESS,
  DOPPLER_HOOK_INITIALIZER,
  DOPPLER_HOOK_MIGRATOR,
  NOOP_MIGRATOR,
} from "@/lib/hansome-score/lp/hook-doppler-registry";
import { classifyHookPrincipalLock } from "@/lib/hansome-score/lp/hook-lock-classifier";
import type { HookProtocolSnapshot } from "@/lib/hansome-score/lp/hook-lock-classifier/protocol-reads";
import type { HookForeignLpSeparation } from "@/lib/hansome-score/lp/hook-foreign-lp/types";
import type { HookPositionValuationSummary } from "@/lib/hansome-score/lp/hook-position-valuer/types";

const FAKE_INIT = "0x2222222222222222222222222222222222222222";

function statusName(status: number): string {
  switch (status) {
    case 1:
      return "Initialized";
    case 2:
      return "Locked";
    case 3:
      return "Graduated";
    case 4:
      return "Exited";
    default:
      return "Unknown";
  }
}

type AirlockOverride = NonNullable<HookProtocolSnapshot["assetData"]>;
type DopplerOverride = NonNullable<HookProtocolSnapshot["hookState"]>;

function protocol(opts: {
  status?: number;
  migrator?: string;
  initializer?: string;
  sfl?: HookProtocolSnapshot["sfl"];
  hookPosmNftBalance?: bigint | null;
  assetData?: AirlockOverride | null;
  hookState?: DopplerOverride | null;
  errors?: string[];
} = {}): HookProtocolSnapshot {
  const status = opts.status ?? 2;
  const assetData: HookProtocolSnapshot["assetData"] =
    opts.assetData === null
      ? null
      : {
          numeraire: "0x0Bd78c2C7cA1dE0000000000000000000000AD73",
          timelock: "0x0000000000000000000000000000000000000000",
          governance: DEAD_ADDRESS,
          liquidityMigrator: opts.migrator ?? NOOP_MIGRATOR,
          poolInitializer: opts.initializer ?? DOPPLER_HOOK_INITIALIZER,
          pool: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
          migrationPool: DEAD_ADDRESS,
          numTokensToSell: "1",
          totalSupply: "1",
          integrator: "0x0000000000000000000000000000000000000000",
          ...(opts.assetData ?? {}),
        };
  const hookState: HookProtocolSnapshot["hookState"] =
    opts.hookState === null
      ? null
      : {
          status,
          statusName: statusName(status),
          currency0: "0x1b0E319c6A659F002271B69dB8A7df2F911c153E",
          currency1: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
          fee: 0x800000,
          tickSpacing: 200,
          hooks: DOPPLER_HOOK_INITIALIZER,
          farTick: -887000,
          ...(opts.hookState ?? {}),
        };
  return {
    tokenOwner: "0xeb7C034704eF8Dcd2D32324c1545f62fB4aD0862",
    tokenOwnerIsAirlock: true,
    assetData,
    hookState,
    hookPosmNftBalance:
      opts.hookPosmNftBalance === undefined ? 0n : opts.hookPosmNftBalance,
    sfl: opts.sfl ?? { exists: false },
    initializerModuleState: 3,
    migratorModuleState: 4,
    errors: opts.errors ?? [],
  };
}

function valuation(
  over: Partial<HookPositionValuationSummary> = {},
): HookPositionValuationSummary {
  return {
    poolId: "0x3623",
    indexedPositionCount: 8,
    activePositionCount: 8,
    hookOwnedPositionCount: 8,
    activeHookOwnedPositionCount: 8,
    hookOwnedAmount0Raw: "1000",
    hookOwnedAmount1Raw: "2000",
    hookOwnedAmount0: "1",
    hookOwnedAmount1: "2",
    hookOwnedValueUsd: 1234,
    hookValuationComplete: true,
    foreignValuationComplete: false,
    priceDataComplete: true,
    ...over,
  };
}

function foreign(
  over: Partial<HookForeignLpSeparation> = {},
): HookForeignLpSeparation {
  return {
    poolId: "0x3623",
    hookOwned: {
      positionCount: 8,
      activeCount: 8,
      valueUsd: 1234,
      amount0: "1",
      amount1: "2",
    },
    foreignPosm: { positionCount: 0, activeCount: 0, valueUsd: 0 },
    foreignOther: { positionCount: 0, activeCount: 0, valueUsd: 0 },
    foreignTotalValueUsd: 0,
    hookDiscoveryComplete: true,
    foreignDiscoveryComplete: false,
    hookValuationComplete: true,
    foreignValuationComplete: false,
    poolReconstructionComplete: false,
    hookOwnedAmountsComplete: true,
    ...over,
  };
}

describe("Phase 11H — Hook Lock Classifier", () => {
  it("Locked + allowlisted initializer + NoOp + complete → HOOK_PRINCIPAL_LOCKED_ONCHAIN", () => {
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({ status: 2 }),
      valuationSummary: valuation(),
      foreignSeparation: foreign(),
      materialHookPrincipal: true,
    });
    expect(r.state).toBe("HOOK_PRINCIPAL_LOCKED_ONCHAIN");
    expect(r.lockAmountComplete).toBe(true);
    expect(r.poolShareAvailable).toBe(false);
    expect(r.evidence).toContain("migrator=NoOpMigrator");
  });

  it("Locked + incomplete Hook index → UNKNOWN_INCOMPLETE", () => {
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({ status: 2 }),
      valuationSummary: valuation({ hookValuationComplete: false }),
      foreignSeparation: foreign({
        hookDiscoveryComplete: false,
        hookValuationComplete: false,
        hookOwnedAmountsComplete: false,
      }),
      materialHookPrincipal: true,
    });
    expect(r.state).toBe("UNKNOWN_INCOMPLETE");
    expect(r.incompleteReasons).toContain("hook_discovery_incomplete");
  });

  it("Locked + incomplete valuation → UNKNOWN_INCOMPLETE", () => {
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({ status: 2 }),
      valuationSummary: valuation({ hookValuationComplete: false }),
      foreignSeparation: foreign({
        hookDiscoveryComplete: true,
        hookValuationComplete: false,
      }),
      materialHookPrincipal: true,
    });
    expect(r.state).toBe("UNKNOWN_INCOMPLETE");
    expect(r.incompleteReasons).toContain("hook_valuation_incomplete");
  });

  it("Initialized + NoOp → HOOK_UNLOCKABLE (not Locked)", () => {
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({ status: 1, migrator: NOOP_MIGRATOR }),
      valuationSummary: valuation(),
      foreignSeparation: foreign(),
      materialHookPrincipal: true,
    });
    expect(r.state).toBe("HOOK_UNLOCKABLE");
    expect(r.state).not.toBe("HOOK_PRINCIPAL_LOCKED_ONCHAIN");
  });

  it("Initialized + Hook migrator → HOOK_MIGRATION_PENDING", () => {
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({ status: 1, migrator: DOPPLER_HOOK_MIGRATOR }),
      valuationSummary: valuation(),
      foreignSeparation: foreign(),
      materialHookPrincipal: true,
    });
    expect(r.state).toBe("HOOK_MIGRATION_PENDING");
  });

  it("SFL timed stream → HOOK_TIMED_LOCK with unlockTime", () => {
    const now = 1_700_000_000;
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({
        status: 2,
        migrator: DOPPLER_HOOK_MIGRATOR,
        sfl: {
          exists: true,
          recipient: "0x3333333333333333333333333333333333333333",
          startDate: now - 100,
          lockDuration: 10_000,
          isUnlocked: false,
          unlockTime: now - 100 + 10_000,
        },
      }),
      valuationSummary: valuation(),
      foreignSeparation: foreign(),
      materialHookPrincipal: true,
      nowSec: now,
    });
    expect(r.state).toBe("HOOK_TIMED_LOCK");
    expect(r.unlockTime).toBe(now - 100 + 10_000);
  });

  it("SFL dead recipient → HOOK_PERMANENT_LOCK", () => {
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({
        status: 2,
        migrator: DOPPLER_HOOK_MIGRATOR,
        sfl: {
          exists: true,
          recipient: DEAD_ADDRESS,
          startDate: 1,
          lockDuration: 1,
          isUnlocked: false,
          unlockTime: 2,
        },
      }),
      valuationSummary: valuation(),
      foreignSeparation: foreign(),
      materialHookPrincipal: true,
    });
    expect(r.state).toBe("HOOK_PERMANENT_LOCK");
  });

  it("Graduated → HOOK_GRADUATED_INCOMPLETE", () => {
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({ status: 3 }),
      valuationSummary: valuation(),
      foreignSeparation: foreign(),
      materialHookPrincipal: true,
    });
    expect(r.state).toBe("HOOK_GRADUATED_INCOMPLETE");
  });

  it("Exited → HOOK_EXITED", () => {
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({ status: 4 }),
      valuationSummary: valuation(),
      foreignSeparation: foreign(),
      materialHookPrincipal: true,
    });
    expect(r.state).toBe("HOOK_EXITED");
  });

  it("arbitrary fake initializer → UNKNOWN_INCOMPLETE", () => {
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({ status: 2, initializer: FAKE_INIT }),
      valuationSummary: valuation(),
      foreignSeparation: foreign(),
      materialHookPrincipal: true,
    });
    expect(r.state).toBe("UNKNOWN_INCOMPLETE");
    expect(r.incompleteReasons).toContain("pool_initializer_not_allowlisted");
  });

  it("foreign LP never counted as Hook principal", () => {
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({ status: 2 }),
      valuationSummary: valuation({ hookOwnedValueUsd: 100 }),
      foreignSeparation: foreign({
        hookOwned: {
          positionCount: 8,
          activeCount: 8,
          valueUsd: 100,
        },
        foreignPosm: { positionCount: 2, activeCount: 2, valueUsd: 9999 },
      }),
      materialHookPrincipal: true,
    });
    expect(r.state).toBe("HOOK_PRINCIPAL_LOCKED_ONCHAIN");
    expect(r.principalValueUsd).toBe(100);
    expect(r.principalValueUsd).not.toBe(9999);
  });

  it("does not map to Titan LOCKED_VERIFIED", () => {
    const r = classifyHookPrincipalLock({
      ownershipClass: "hook_native",
      protocol: protocol({ status: 2 }),
      valuationSummary: valuation(),
      foreignSeparation: foreign(),
      materialHookPrincipal: true,
    });
    expect(String(r.state)).not.toContain("LOCKED_VERIFIED");
    expect(r.state).not.toBe("LOCKED" as never);
  });
});
