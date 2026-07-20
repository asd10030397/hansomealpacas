/**
 * Cross-route gate for Battle Result → Commit auto-navigation.
 *
 * Single source of truth for “battle fully presented”:
 *   presentationComplete(wallet, battleDay)
 *
 * Busy / preparing / queue are transient execution signals only.
 * React effect cleanup must never clear presentationComplete or force-navigate.
 */

import {
  isSettlementBattleReady,
  type SettlementUiStatus,
} from "@/lib/game/settlementStatus";

type Listener = () => void;

const preparingOwners = new Set<string>();
const queueOwners = new Set<string>();
const completeKeys = new Set<string>();
const listeners = new Set<Listener>();

/** Non-blocking recovery copy after failsafe — never implies presentation was discarded. */
let failsafeNotice = false;

function key(wallet: string, day: number): string {
  return `${(wallet || "anon").toLowerCase()}:${day}`;
}

function notify(): void {
  for (const l of listeners) l();
}

function syncBusyFromOwners(): void {
  // Busy is derived — callers mutate owner sets then notify.
  notify();
}

/** True while any owner reports preparing or an active presentation queue. */
export function isBattlePresentationBusy(): boolean {
  return preparingOwners.size > 0 || queueOwners.size > 0;
}

/** Queue ownership idle (no active cue owner). */
export function isPresentationQueueIdle(): boolean {
  return queueOwners.size === 0;
}

/**
 * @deprecated Prefer setPresentationPreparing / setPresentationQueueActive.
 * Kept for narrow call sites; does not clear presentationComplete.
 */
export function setBattlePresentationBusy(next: boolean): void {
  const owner = "__legacy__";
  if (next) {
    preparingOwners.add(owner);
  } else {
    preparingOwners.delete(owner);
    queueOwners.delete(owner);
  }
  syncBusyFromOwners();
}

/** Result page (or other owner) reports settlement still preparing for battleDay. */
export function setPresentationPreparing(owner: string, preparing: boolean): void {
  if (preparing) preparingOwners.add(owner);
  else preparingOwners.delete(owner);
  syncBusyFromOwners();
}

/** Result page reports presentation queue actively playing or queued. */
export function setPresentationQueueActive(owner: string, active: boolean): void {
  if (active) queueOwners.add(owner);
  else queueOwners.delete(owner);
  syncBusyFromOwners();
}

/** Release all transient ownership for an owner (e.g. Result unmount). Never clears complete. */
export function releasePresentationOwner(owner: string): void {
  preparingOwners.delete(owner);
  queueOwners.delete(owner);
  syncBusyFromOwners();
}

export function markBattlePresentationComplete(wallet: string, day: number): void {
  const k = key(wallet, day);
  if (completeKeys.has(k)) {
    notify();
    return;
  }
  completeKeys.add(k);
  notify();
}

export function isBattlePresentationComplete(
  wallet: string,
  day: number,
): boolean {
  return completeKeys.has(key(wallet, day));
}

/**
 * Authoritative navigate permission after battleDay → next COMMIT.
 * Requires presentationComplete + idle queue. Busy alone is never enough.
 */
export function canNavigateAfterBattle(
  wallet: string,
  battleDay: number,
): boolean {
  if (battleDay < 0) return false;
  if (!isBattlePresentationComplete(wallet, battleDay)) return false;
  if (!isPresentationQueueIdle()) return false;
  return true;
}

export function getBattlePresentationFailsafeNotice(): boolean {
  return failsafeNotice;
}

export function setBattlePresentationFailsafeNotice(next: boolean): void {
  if (failsafeNotice === next) return;
  failsafeNotice = next;
  notify();
}

export function subscribeBattlePresentation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Unfinished settlement UI — preparing until battle-ready (not until credits done). */
export function isBattleSettlementPreparing(input: {
  status: SettlementUiStatus;
  revealing?: boolean;
}): boolean {
  if (input.revealing) return true;
  return !isSettlementBattleReady(input.status);
}

/** Battle-ready for VFX: finalized on-chain (credits may still batch). */
export function isBattlePresentationDataReady(input: {
  status: SettlementUiStatus;
  hasPresentableRows: boolean;
}): boolean {
  return (
    isSettlementBattleReady(input.status) && input.hasPresentableRows
  );
}

export type BattlePresentationRowReadiness = {
  missedReveal?: boolean;
  outcome: string;
  locationId?: number | null;
  /** null = still loading day reward; 0n is a real zero. */
  rewardWei?: bigint | null;
  rewardLabel?: string;
  activatedAbility?: string | null;
};

/**
 * Decisive row for FX / complete: not awaiting placeholders or missing location/reward.
 * Genuine missed-reveal rows count as ready (no FX to play).
 */
export function isBattlePresentationRowReady(
  row: BattlePresentationRowReadiness,
): boolean {
  if (row.missedReveal) return true;

  const o = (row.outcome ?? "").trim().toLowerCase();
  if (!o || o === "—" || o === "-") return false;
  if (
    o.includes("awaiting") ||
    o.includes("settled on-chain") ||
    o.includes("not exposed")
  ) {
    return false;
  }

  if (row.locationId == null) return false;

  if (row.rewardWei == null) return false;
  const label = (row.rewardLabel ?? "").trim();
  if (label === "…" || /^pending$/i.test(label)) return false;

  return true;
}

/** All participant rows have decisive presentation data (or there are none). */
export function areBattlePresentationRowsReady(
  rows: readonly BattlePresentationRowReadiness[],
): boolean {
  if (rows.length === 0) return true;
  return rows.every(isBattlePresentationRowReady);
}

/**
 * Mark presentationComplete only after battle-ready rows are decisive and the
 * cue queue is idle. Never complete while rows still lack location/outcome/reward
 * (rowsReady=false). When hasPresentableRows, require FX queue enabled so we do
 * not complete on the idle stub before cues are armed.
 */
export function canMarkBattlePresentationComplete(input: {
  status: SettlementUiStatus;
  queueStatus: string;
  rowsReady: boolean;
  hasPresentableRows: boolean;
  /** True while Result page has enabled the presentation queue. */
  presentationFxEnabled: boolean;
}): boolean {
  if (!isSettlementBattleReady(input.status)) return false;
  if (!input.rowsReady) return false;
  if (input.queueStatus !== "idle") return false;
  // All-missed / no-FX: complete when decisive. Presentable: wait until FX armed.
  if (input.hasPresentableRows && !input.presentationFxEnabled) return false;
  return true;
}

export function resetBattlePresentationGateForTests(): void {
  preparingOwners.clear();
  queueOwners.clear();
  completeKeys.clear();
  failsafeNotice = false;
  listeners.clear();
}
