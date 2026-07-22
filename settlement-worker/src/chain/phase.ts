/**

 * Pure day-clock helpers — worker settle timing policy.

 *

 * Worker policy (both profiles): finalize/credit only after revealEnd

 * (mirrors Mainnet Solidity `_settlePhaseOk` for chainId 4663).

 *

 * Note: Testnet Solidity still allows finalize once commit ends; other

 * callers may settle early. This worker intentionally waits for revealEnd

 * so Testnet matches production architecture (player self-reveal window).

 */



export const MAINNET_CHAIN_ID = 4663;

export const TESTNET_CHAIN_ID = 46630;



export type GameTiming = {

  dayZero: number;

  dayLength: number;

  commitDuration: number;

  revealDuration: number;

};



export type DayWindows = {

  day: number;

  dayStart: number;

  commitEnd: number;

  revealEnd: number;

  dayEnd: number;

};



export function dayWindows(timing: GameTiming, day: number): DayWindows {

  const dayStart = timing.dayZero + day * timing.dayLength;

  const commitEnd = dayStart + timing.commitDuration;

  const revealEnd = commitEnd + timing.revealDuration;

  const dayEnd = dayStart + timing.dayLength;

  return { day, dayStart, commitEnd, revealEnd, dayEnd };

}



export function computeCurrentDay(timing: GameTiming, nowSec: number): number {

  if (nowSec < timing.dayZero) return 0;

  return Math.floor((nowSec - timing.dayZero) / timing.dayLength);

}



/** Seed may be fulfilled once the day has started (commit open or later). */

export function isSeedPhaseOk(windows: DayWindows, nowSec: number): boolean {

  return nowSec >= windows.dayStart;

}



/**

 * Worker settle gate: finalize/credit only after revealEnd for every profile.

 * `chainId` kept for call-site compatibility; settle timing no longer branches.

 */

export function isSettlePhaseOk(

  _chainId: number,

  windows: DayWindows,

  nowSec: number,

): boolean {

  return nowSec >= windows.revealEnd;

}



export type PhaseLabel =

  | "before_day_zero"

  | "commit"

  | "reveal"

  | "settle_window"

  | "next_day";



export function phaseLabel(

  _chainId: number,

  timing: GameTiming,

  day: number,

  nowSec: number,

): PhaseLabel {

  if (nowSec < timing.dayZero) return "before_day_zero";

  const w = dayWindows(timing, day);

  if (nowSec < w.dayStart) return "before_day_zero";

  if (nowSec < w.commitEnd) return "commit";

  if (nowSec < w.revealEnd) return "reveal";

  if (nowSec < w.dayEnd) return "settle_window";

  return "next_day";

}


