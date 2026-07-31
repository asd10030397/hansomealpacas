/**
 * Phase 11H — Hook principal lock classifier (predicates A–H).
 * Never maps to Titan LOCKED_VERIFIED / generic lock %.
 */

import { getAddress } from "viem";
import {
  HOOK_POOL_STATUS,
  isAllowlistedHookMigrator,
  isAllowlistedNoOpMigrator,
  isAllowlistedPoolInitializer,
  isDeadAddress,
  STREAMABLE_FEES_LOCKER_V2,
} from "@/lib/hansome-score/lp/hook-doppler-registry";
import type { HookForeignLpSeparation } from "@/lib/hansome-score/lp/hook-foreign-lp/types";
import type { HookPositionValuationSummary } from "@/lib/hansome-score/lp/hook-position-valuer/types";
import type { HookProtocolSnapshot } from "@/lib/hansome-score/lp/hook-lock-classifier/protocol-reads";
import type {
  HookLockClassification,
  HookLockClassificationPublic,
  HookPrincipalLockState,
} from "@/lib/hansome-score/lp/hook-lock-classifier/types";

export type ClassifyHookLockParams = {
  ownershipClass: "posm_nft" | "hook_native" | "unknown" | null | undefined;
  protocol: HookProtocolSnapshot;
  valuationSummary: HookPositionValuationSummary;
  foreignSeparation: HookForeignLpSeparation;
  /** Proven material hook-owned L or amounts. */
  materialHookPrincipal: boolean;
  nowSec?: number;
};

function materialPrincipalProven(params: ClassifyHookLockParams): boolean {
  if (params.materialHookPrincipal) return true;
  const v = params.valuationSummary;
  if (
    v.activeHookOwnedPositionCount > 0 &&
    v.hookValuationComplete &&
    (v.hookOwnedAmount0Raw != null || v.hookOwnedValueUsd != null)
  ) {
    try {
      return BigInt(v.hookOwnedAmount0Raw ?? "0") > 0n ||
        BigInt(v.hookOwnedAmount1Raw ?? "0") > 0n ||
        (v.hookOwnedValueUsd != null && v.hookOwnedValueUsd > 0);
    } catch {
      return v.activeHookOwnedPositionCount > 0;
    }
  }
  return false;
}

export function classifyHookPrincipalLock(
  params: ClassifyHookLockParams,
): HookLockClassification {
  const evidence: string[] = [];
  const incomplete: string[] = [
    ...(params.protocol.errors ?? []),
    ...(params.valuationSummary.incompleteReasons ?? []),
    ...(params.foreignSeparation.incompleteReasons ?? []),
  ];
  const hookDiscoveryComplete =
    params.foreignSeparation.hookDiscoveryComplete;
  const hookValuationComplete =
    params.foreignSeparation.hookValuationComplete;
  const foreignDiscoveryComplete =
    params.foreignSeparation.foreignDiscoveryComplete;
  const poolShareAvailable =
    params.foreignSeparation.poolReconstructionComplete &&
    params.foreignSeparation.hookShareOfReconstructedPool != null;

  const baseAmounts = {
    principalValueUsd: params.foreignSeparation.hookOwned.valueUsd,
    principalAmount0: params.foreignSeparation.hookOwned.amount0,
    principalAmount1: params.foreignSeparation.hookOwned.amount1,
  };

  const finish = (
    state: HookPrincipalLockState,
    extra?: Partial<HookLockClassification>,
  ): HookLockClassification => {
    const lockAmountComplete =
      state === "HOOK_PRINCIPAL_LOCKED_ONCHAIN" ||
      state === "HOOK_PERMANENT_LOCK" ||
      state === "HOOK_TIMED_LOCK"
        ? hookDiscoveryComplete &&
          hookValuationComplete &&
          materialPrincipalProven(params)
        : false;

    let hookPrincipalLockedShare: number | undefined;
    if (
      lockAmountComplete &&
      baseAmounts.principalValueUsd != null &&
      baseAmounts.principalValueUsd > 0
    ) {
      // Entire valued hook principal set is locked under Locked+NoOp
      hookPrincipalLockedShare = 1;
    }

    return {
      state,
      ...baseAmounts,
      unlockTime: extra?.unlockTime,
      status: params.protocol.hookState?.statusName,
      poolInitializer: params.protocol.assetData?.poolInitializer,
      liquidityMigrator: params.protocol.assetData?.liquidityMigrator,
      locker: extra?.locker,
      hookDiscoveryComplete,
      hookValuationComplete,
      foreignDiscoveryComplete,
      lockAmountComplete,
      poolShareAvailable,
      hookPrincipalLockedShare,
      evidence: [...evidence, ...(extra?.evidence ?? [])],
      incompleteReasons: [...new Set([...(incomplete), ...(extra?.incompleteReasons ?? [])])],
      terminalState:
        state === "UNKNOWN_INCOMPLETE"
          ? "UNKNOWN_INCOMPLETE"
          : extra?.terminalState ?? "CLASSIFIED",
    };
  };

  if (params.ownershipClass !== "hook_native") {
    incomplete.push("ownership_class_not_hook_native");
    evidence.push("ownership_class≠hook_native");
    return finish("UNKNOWN_INCOMPLETE");
  }
  evidence.push("ownership_class=hook_native");

  const asset = params.protocol.assetData;
  const state = params.protocol.hookState;

  if (!asset) {
    incomplete.push("airlock_asset_data_unavailable");
    return finish("UNKNOWN_INCOMPLETE", { terminalState: "UNKNOWN_INCOMPLETE" });
  }
  if (!state) {
    incomplete.push("hook_state_unavailable");
    return finish("UNKNOWN_INCOMPLETE", { terminalState: "UNKNOWN_INCOMPLETE" });
  }

  evidence.push(`status=${state.statusName}`);
  evidence.push(`poolInitializer=${getAddress(asset.poolInitializer)}`);
  evidence.push(`liquidityMigrator=${getAddress(asset.liquidityMigrator)}`);

  if (!isAllowlistedPoolInitializer(asset.poolInitializer)) {
    incomplete.push("pool_initializer_not_allowlisted");
    evidence.push("initializer_registry_miss");
    return finish("UNKNOWN_INCOMPLETE");
  }
  evidence.push("pool_initializer_allowlisted");

  // F. Exited
  if (state.status === HOOK_POOL_STATUS.Exited) {
    evidence.push("status=Exited");
    return finish("HOOK_EXITED", { terminalState: "CLASSIFIED" });
  }

  // G. Graduated
  if (state.status === HOOK_POOL_STATUS.Graduated) {
    evidence.push("status=Graduated");
    incomplete.push("post_graduation_principal_incomplete");
    return finish("HOOK_GRADUATED_INCOMPLETE", {
      terminalState: "CLASSIFIED",
    });
  }

  // SFL paths (B / C) — only when stream exists
  const sfl = params.protocol.sfl;
  if (sfl?.exists) {
    evidence.push("sfl_stream_exists");
    const now = params.nowSec ?? Math.floor(Date.now() / 1000);
    if (isDeadAddress(sfl.recipient)) {
      if (
        hookDiscoveryComplete &&
        hookValuationComplete &&
        materialPrincipalProven(params)
      ) {
        evidence.push("sfl_recipient=dead");
        return finish("HOOK_PERMANENT_LOCK", {
          locker: STREAMABLE_FEES_LOCKER_V2,
          terminalState: "CLASSIFIED",
        });
      }
      incomplete.push("sfl_permanent_positions_incomplete");
      return finish("UNKNOWN_INCOMPLETE");
    }
    if (
      sfl.startDate != null &&
      sfl.lockDuration != null &&
      sfl.unlockTime != null &&
      !sfl.isUnlocked &&
      now < sfl.unlockTime &&
      hookDiscoveryComplete &&
      hookValuationComplete &&
      materialPrincipalProven(params)
    ) {
      evidence.push("sfl_timed_lock_active");
      return finish("HOOK_TIMED_LOCK", {
        unlockTime: sfl.unlockTime,
        locker: STREAMABLE_FEES_LOCKER_V2,
        terminalState: "CLASSIFIED",
      });
    }
    incomplete.push("sfl_stream_incomplete_or_expired");
  }

  // D / E — Initialized paths
  if (state.status === HOOK_POOL_STATUS.Initialized) {
    evidence.push("status=Initialized");
    if (isAllowlistedHookMigrator(asset.liquidityMigrator)) {
      evidence.push("migrator=DopplerHookMigrator");
      return finish("HOOK_MIGRATION_PENDING", { terminalState: "CLASSIFIED" });
    }
    // Initialized + NoOp is NOT locked — exitLiquidity may be possible
    if (isAllowlistedNoOpMigrator(asset.liquidityMigrator)) {
      evidence.push("initialized_noop_not_locked");
      return finish("HOOK_UNLOCKABLE", { terminalState: "CLASSIFIED" });
    }
    return finish("HOOK_UNLOCKABLE", { terminalState: "CLASSIFIED" });
  }

  // A. HOOK_PRINCIPAL_LOCKED_ONCHAIN — all predicates
  if (state.status === HOOK_POOL_STATUS.Locked) {
    evidence.push("status=Locked");

    if (!isAllowlistedNoOpMigrator(asset.liquidityMigrator)) {
      if (isAllowlistedHookMigrator(asset.liquidityMigrator)) {
        incomplete.push("locked_but_non_noop_migrator");
        return finish("HOOK_MIGRATION_PENDING");
      }
      incomplete.push("migrator_not_allowlisted_noop");
      return finish("UNKNOWN_INCOMPLETE");
    }
    evidence.push("migrator=NoOpMigrator");

    if (
      params.protocol.hookPosmNftBalance == null ||
      params.protocol.hookPosmNftBalance !== 0n
    ) {
      incomplete.push("hook_posm_nft_balance_nonzero_or_unknown");
      evidence.push(
        `hook_posm_balance=${params.protocol.hookPosmNftBalance?.toString() ?? "null"}`,
      );
      return finish("UNKNOWN_INCOMPLETE");
    }
    evidence.push("hook_posm_balance=0");

    if (!hookDiscoveryComplete) {
      incomplete.push("hook_discovery_incomplete");
      return finish("UNKNOWN_INCOMPLETE");
    }
    evidence.push("hook_discovery_complete");

    if (!hookValuationComplete) {
      incomplete.push("hook_valuation_incomplete");
      // Candidate safe rule: prefer UNKNOWN_INCOMPLETE
      return finish("UNKNOWN_INCOMPLETE");
    }
    evidence.push("hook_valuation_complete");

    if (!materialPrincipalProven(params)) {
      incomplete.push("material_hook_principal_unproven");
      return finish("UNKNOWN_INCOMPLETE");
    }
    evidence.push("material_hook_principal_proven");
    evidence.push("no_principal_exit_path_while_locked");

    return finish("HOOK_PRINCIPAL_LOCKED_ONCHAIN", {
      terminalState: "CLASSIFIED",
    });
  }

  incomplete.push("status_unhandled");
  return finish("UNKNOWN_INCOMPLETE", { terminalState: "UNKNOWN_INCOMPLETE" });
}

export function toPublicHookLockClassification(
  c: HookLockClassification,
): HookLockClassificationPublic {
  return {
    state: c.state,
    principalValueUsd: c.principalValueUsd,
    unlockTime: c.unlockTime,
    lockAmountComplete: c.lockAmountComplete,
    poolShareAvailable: c.poolShareAvailable,
    evidence: c.evidence,
    incompleteReasons: c.incompleteReasons,
  };
}

/** Display labels — not Titan / generic Locked. */
export const HOOK_PRINCIPAL_LOCK_DISPLAY: Record<
  HookPrincipalLockState,
  { en: string; zh: string }
> = {
  HOOK_PRINCIPAL_LOCKED_ONCHAIN: {
    en: "Principal locked on-chain",
    zh: "本金已鏈上鎖定",
  },
  HOOK_TIMED_LOCK: {
    en: "Timed Hook lock",
    zh: "Hook 限期鎖定",
  },
  HOOK_PERMANENT_LOCK: {
    en: "Permanent Hook lock",
    zh: "Hook 永久鎖定",
  },
  HOOK_UNLOCKABLE: {
    en: "Unlockable",
    zh: "可解鎖",
  },
  HOOK_MIGRATION_PENDING: {
    en: "Migration pending",
    zh: "遷移待完成",
  },
  HOOK_EXITED: {
    en: "Exited",
    zh: "已退出",
  },
  HOOK_GRADUATED_INCOMPLETE: {
    en: "Graduated — incomplete",
    zh: "已畢業 — 資料不完整",
  },
  UNKNOWN_INCOMPLETE: {
    en: "Unknown — incomplete",
    zh: "未知 — 資料不完整",
  },
};
