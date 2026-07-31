import { getAddress } from "viem";
import { UNIVERSAL_ROUTER_ADDRESS } from "@/lib/chain";
import { POOL_MANAGER_ADDRESS } from "@/lib/hansome-score/constants";
import type { CreatorBehaviourResult, CreatorTransferEvidence } from "@/lib/hansome-score/types";

/** Known AMM / router sinks on Robinhood — creator→sink counts as a sell. */
const SELL_SINKS = new Set(
  [
    POOL_MANAGER_ADDRESS,
    UNIVERSAL_ROUTER_ADDRESS,
    // UniversalUniswapV4Adapter (seen on RH Blockscout swap transfers)
    "0xA687b664662B96b180346D699a6d5b42e9B05d31",
  ].map((a) => a.toLowerCase()),
);

export type IndexedTokenTransfer = {
  from: string;
  to: string;
  valueRaw: string;
  blockNumber: number | null;
  timestamp: string | null;
  txHash: string | null;
  toIsContract: boolean | null;
  method: string | null;
};

export type AnalyzeCreatorInput = {
  deployer: string | null;
  totalSupply: bigint | null;
  transfers: IndexedTokenTransfer[];
  /** True when pagination exhausted (or token has zero transfers). */
  paginationComplete: boolean;
  /** True when Blockscout fetch failed before a usable index. */
  fetchFailed?: boolean;
  pagesFetched?: number;
};

function isSellSink(to: string, toIsContract: boolean | null, method: string | null): boolean {
  const lc = to.toLowerCase();
  if (SELL_SINKS.has(lc)) return true;
  const m = (method ?? "").toLowerCase();
  if (m.includes("swap") || m.includes("exactinput") || m.includes("exactoutput")) {
    return toIsContract === true;
  }
  return false;
}

function pctOfSupply(amount: bigint, totalSupply: bigint): number {
  if (totalSupply <= 0n) return 0;
  return (Number(amount) / Number(totalSupply)) * 100;
}

type AnalyzedCreatorSlice = {
  dumpDetected: boolean;
  transferThenSellDetected: boolean;
  creatorSellPctOfSupply: number;
  outboundTransferCount: number;
  sellTransferCount: number;
  transferThenSellRecipientCount: number;
  evidence: CreatorTransferEvidence[];
  detailBody: string;
};

/**
 * Analyze deployer sells over a transfer slice.
 * Scoring still gates on `available` (full pagination) — this slice powers UI facts
 * even when the index is incomplete.
 */
function analyzeCreatorSlice(
  deployer: string,
  totalSupply: bigint,
  transfers: IndexedTokenTransfer[],
  pagesFetched: number,
  complete: boolean,
): AnalyzedCreatorSlice {
  const deployerLc = getAddress(deployer).toLowerCase();
  const evidence: CreatorTransferEvidence[] = [];
  let sellRaw = 0n;
  let outboundCount = 0;
  let sellCount = 0;

  const eoaRecipients = new Map<string, bigint>();

  for (const t of transfers) {
    if (t.from.toLowerCase() !== deployerLc) continue;
    outboundCount++;
    let value = 0n;
    try {
      value = BigInt(t.valueRaw);
    } catch {
      value = 0n;
    }

    if (isSellSink(t.to, t.toIsContract, t.method)) {
      sellCount++;
      sellRaw += value;
      evidence.push({
        kind: "sell",
        from: t.from,
        to: t.to,
        valueRaw: t.valueRaw,
        pctOfSupply: pctOfSupply(value, totalSupply),
        txHash: t.txHash,
        blockNumber: t.blockNumber,
        timestamp: t.timestamp,
      });
      continue;
    }

    if (t.toIsContract !== true) {
      const prev = eoaRecipients.get(t.to.toLowerCase()) ?? 0n;
      eoaRecipients.set(t.to.toLowerCase(), prev + value);
      evidence.push({
        kind: "transfer",
        from: t.from,
        to: t.to,
        valueRaw: t.valueRaw,
        pctOfSupply: pctOfSupply(value, totalSupply),
        txHash: t.txHash,
        blockNumber: t.blockNumber,
        timestamp: t.timestamp,
      });
    }
  }

  let transferThenSellRaw = 0n;
  let transferThenSellRecipientCount = 0;
  for (const [recipient, received] of eoaRecipients) {
    if (received <= 0n) continue;
    let soldFromRecipient = 0n;
    for (const t of transfers) {
      if (t.from.toLowerCase() !== recipient) continue;
      if (!isSellSink(t.to, t.toIsContract, t.method)) continue;
      try {
        soldFromRecipient += BigInt(t.valueRaw);
      } catch {
        /* skip */
      }
    }
    if (soldFromRecipient <= 0n) continue;
    const linked = soldFromRecipient < received ? soldFromRecipient : received;
    transferThenSellRaw += linked;
    transferThenSellRecipientCount++;
    evidence.push({
      kind: "transfer_then_sell",
      from: deployer,
      to: recipient,
      valueRaw: linked.toString(),
      pctOfSupply: pctOfSupply(linked, totalSupply),
      txHash: null,
      blockNumber: null,
      timestamp: null,
    });
  }

  const creatorSellPctOfSupply = pctOfSupply(sellRaw, totalSupply);
  const transferThenSellPct = pctOfSupply(transferThenSellRaw, totalSupply);
  const dumpDetected = creatorSellPctOfSupply > 5;
  const transferThenSellDetected = !dumpDetected && transferThenSellPct > 2;

  const detailParts = [
    `Indexed ${transfers.length} token transfers (${pagesFetched} page(s); ${complete ? "complete" : "incomplete — Score keeps provisional path"}).`,
    `Deployer outbound: ${outboundCount}; direct sells to AMM/router: ${sellCount} (~${creatorSellPctOfSupply.toFixed(2)}% supply).`,
  ];
  if (transferThenSellRecipientCount > 0) {
    detailParts.push(
      `Transfer-then-sell pattern recipients: ${transferThenSellRecipientCount} (~${transferThenSellPct.toFixed(2)}% supply linked).`,
    );
  }
  if (!dumpDetected && !transferThenSellDetected) {
    detailParts.push("No large creator dump or material transfer-then-sell pattern detected in indexed history.");
  }

  return {
    dumpDetected,
    transferThenSellDetected,
    creatorSellPctOfSupply,
    outboundTransferCount: outboundCount,
    sellTransferCount: sellCount,
    transferThenSellRecipientCount,
    evidence: evidence.slice(0, 40),
    detailBody: detailParts.join(" "),
  };
}

function emptyIncomplete(
  pagesFetched: number,
  transfersIndexed: number,
  paginationComplete: boolean,
  detail: string,
): CreatorBehaviourResult {
  return {
    status: "incomplete",
    available: false,
    dumpDetected: false,
    transferThenSellDetected: false,
    creatorSellPctOfSupply: 0,
    outboundTransferCount: 0,
    sellTransferCount: 0,
    transferThenSellRecipientCount: 0,
    pagesFetched,
    transfersIndexed,
    paginationComplete,
    detail,
    evidence: [],
  };
}

/**
 * Pure creator-behaviour analysis over an indexed transfer set.
 * Large dump: cumulative deployer→DEX/pool sells &gt; 5% supply.
 * Transfer-then-sell: deployer→EOA then that EOA→DEX totaling &gt; 2% (material).
 *
 * Scoring still requires `available: true` (full pagination). Incomplete indexes
 * may still expose observed sell counts for UI while keeping provisional Score path.
 */
export function analyzeCreatorBehaviour(input: AnalyzeCreatorInput): CreatorBehaviourResult {
  const pagesFetched = input.pagesFetched ?? 0;

  if (input.fetchFailed) {
    return emptyIncomplete(
      pagesFetched,
      input.transfers.length,
      false,
      "Creator sell/transfer index unavailable — Blockscout fetch failed (provisional Score path).",
    );
  }

  if (!input.deployer) {
    return emptyIncomplete(
      pagesFetched,
      input.transfers.length,
      input.paginationComplete,
      "Deployer unknown — cannot index creator behaviour.",
    );
  }

  if (input.totalSupply == null || input.totalSupply <= 0n) {
    return emptyIncomplete(
      pagesFetched,
      input.transfers.length,
      input.paginationComplete,
      "Total supply unavailable — cannot size creator sells vs supply.",
    );
  }

  const slice = analyzeCreatorSlice(
    input.deployer,
    input.totalSupply,
    input.transfers,
    pagesFetched,
    input.paginationComplete,
  );

  // Incomplete pagination: keep available=false so Structural Score stays provisional.
  // Still return observed counts/evidence so UI is not stuck on stub zeros.
  if (!input.paginationComplete) {
    return {
      status: "incomplete",
      available: false,
      dumpDetected: slice.dumpDetected,
      transferThenSellDetected: slice.transferThenSellDetected,
      creatorSellPctOfSupply: slice.creatorSellPctOfSupply,
      outboundTransferCount: slice.outboundTransferCount,
      sellTransferCount: slice.sellTransferCount,
      transferThenSellRecipientCount: slice.transferThenSellRecipientCount,
      pagesFetched,
      transfersIndexed: input.transfers.length,
      paginationComplete: false,
      detail: slice.detailBody,
      evidence: slice.evidence,
    };
  }

  return {
    status: "indexed",
    available: true,
    dumpDetected: slice.dumpDetected,
    transferThenSellDetected: slice.transferThenSellDetected,
    creatorSellPctOfSupply: slice.creatorSellPctOfSupply,
    outboundTransferCount: slice.outboundTransferCount,
    sellTransferCount: slice.sellTransferCount,
    transferThenSellRecipientCount: slice.transferThenSellRecipientCount,
    pagesFetched,
    transfersIndexed: input.transfers.length,
    paginationComplete: true,
    detail: slice.detailBody,
    evidence: slice.evidence,
  };
}

export function isKnownSellSink(address: string): boolean {
  return SELL_SINKS.has(address.toLowerCase());
}
