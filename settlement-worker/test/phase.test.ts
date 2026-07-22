import { describe, expect, it } from "vitest";

import {

  MAINNET_CHAIN_ID,

  TESTNET_CHAIN_ID,

  computeCurrentDay,

  dayWindows,

  isSeedPhaseOk,

  isSettlePhaseOk,

  phaseLabel,

} from "../src/chain/phase.js";



const timing = {

  dayZero: 1_000_000,

  // leave headroom after reveal so settle_window is non-empty in labels

  dayLength: 100_000,

  commitDuration: 72000,

  revealDuration: 14400,

};



describe("phase helpers", () => {

  it("computes current day", () => {

    expect(computeCurrentDay(timing, 999_999)).toBe(0);

    expect(computeCurrentDay(timing, 1_000_000)).toBe(0);

    expect(computeCurrentDay(timing, 1_000_000 + timing.dayLength)).toBe(1);

  });



  it("seed only after day start", () => {

    const w = dayWindows(timing, 0);

    expect(isSeedPhaseOk(w, w.dayStart - 1)).toBe(false);

    expect(isSeedPhaseOk(w, w.dayStart)).toBe(true);

  });



  it("mainnet settle only after reveal end", () => {

    const w = dayWindows(timing, 0);

    expect(isSettlePhaseOk(MAINNET_CHAIN_ID, w, w.commitEnd)).toBe(false);

    expect(isSettlePhaseOk(MAINNET_CHAIN_ID, w, w.revealEnd - 1)).toBe(false);

    expect(isSettlePhaseOk(MAINNET_CHAIN_ID, w, w.revealEnd)).toBe(true);

  });



  it("testnet settle only after reveal end (worker policy)", () => {

    const w = dayWindows(timing, 0);

    expect(isSettlePhaseOk(TESTNET_CHAIN_ID, w, w.commitEnd - 1)).toBe(false);

    expect(isSettlePhaseOk(TESTNET_CHAIN_ID, w, w.commitEnd)).toBe(false);

    expect(isSettlePhaseOk(TESTNET_CHAIN_ID, w, w.revealEnd - 1)).toBe(false);

    expect(isSettlePhaseOk(TESTNET_CHAIN_ID, w, w.revealEnd)).toBe(true);

  });



  it("labels phases the same for both profiles", () => {

    const w = dayWindows(timing, 0);

    for (const chainId of [MAINNET_CHAIN_ID, TESTNET_CHAIN_ID]) {

      expect(phaseLabel(chainId, timing, 0, w.dayStart + 1)).toBe("commit");

      expect(phaseLabel(chainId, timing, 0, w.commitEnd + 1)).toBe("reveal");

      expect(phaseLabel(chainId, timing, 0, w.revealEnd + 1)).toBe(

        "settle_window",

      );

    }

  });

});


