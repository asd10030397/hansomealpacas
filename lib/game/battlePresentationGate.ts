/**
 * Cross-route gate so auto-nav to Commit waits for Battle Result VFX/SFX.
 * Presentation / UX only — not settlement math.
 */

type Listener = () => void;

let busy = false;
const completeKeys = new Set<string>();
const listeners = new Set<Listener>();

function key(wallet: string, day: number): string {
  return `${(wallet || "anon").toLowerCase()}:${day}`;
}

function notify(): void {
  for (const l of listeners) l();
}

export function isBattlePresentationBusy(): boolean {
  return busy;
}

export function setBattlePresentationBusy(next: boolean): void {
  if (busy === next) return;
  busy = next;
  notify();
}

export function markBattlePresentationComplete(wallet: string, day: number): void {
  completeKeys.add(key(wallet, day));
  notify();
}

export function isBattlePresentationComplete(
  wallet: string,
  day: number,
): boolean {
  return completeKeys.has(key(wallet, day));
}

/**
 * True when it is safe to leave Battle Result for the next COMMIT day:
 * either the day's result cues finished, or nothing is currently playing
 * (user was not watching / already done).
 */
export function canNavigateAfterBattle(
  _wallet?: string,
  _battleDay?: number,
): boolean {
  if (busy) return false;
  // Day advanced on-chain ⇒ settlement finished; allow if cues idle.
  return true;
}

export function subscribeBattlePresentation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetBattlePresentationGateForTests(): void {
  busy = false;
  completeKeys.clear();
  listeners.clear();
}
