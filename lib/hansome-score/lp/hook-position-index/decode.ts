/**
 * Strict PoolManager.ModifyLiquidity decoder.
 * Client-side topic verification is mandatory (RH RPC false positives).
 */

import { getAddress, type Hex } from "viem";
import { MODIFY_LIQUIDITY_TOPIC0 } from "@/lib/hansome-score/lp/hook-position-index/abis";
import type {
  DecodedModifyLiquidity,
  RawLogLike,
} from "@/lib/hansome-score/lp/hook-position-index/types";

export class ModifyLiquidityDecodeError extends Error {
  constructor(
    message: string,
    readonly code:
      | "BAD_TOPIC0"
      | "BAD_POOL"
      | "BAD_SENDER"
      | "BAD_DATA"
      | "MALFORMED"
      | "MISSING_FIELDS",
  ) {
    super(message);
    this.name = "ModifyLiquidityDecodeError";
  }
}

export function normalizeBytes32(value: string): Hex {
  const v = value.trim().toLowerCase();
  if (!v.startsWith("0x")) {
    throw new ModifyLiquidityDecodeError("bytes32 missing 0x", "MALFORMED");
  }
  const hex = v.slice(2);
  if (!/^[0-9a-f]*$/.test(hex)) {
    throw new ModifyLiquidityDecodeError("bytes32 non-hex", "MALFORMED");
  }
  if (hex.length > 64) {
    throw new ModifyLiquidityDecodeError("bytes32 too long", "MALFORMED");
  }
  return `0x${hex.padStart(64, "0")}` as Hex;
}

export function topicAddress(topic: string): string {
  const t = normalizeBytes32(topic);
  // address is right-aligned in 32-byte topic
  return getAddress(`0x${t.slice(-40)}`);
}

/** Decode ABI-padded signed int24 from a 32-byte hex word (with or without 0x). */
export function decodeSignedInt24(wordHex: string): number {
  const w = wordHex.startsWith("0x") ? wordHex.slice(2) : wordHex;
  if (w.length !== 64 || !/^[0-9a-fA-F]+$/.test(w)) {
    throw new ModifyLiquidityDecodeError("int24 word malformed", "BAD_DATA");
  }
  // int24 is sign-extended into 32 bytes; take low 24 bits
  const raw = Number.parseInt(w.slice(-6), 16);
  // sign-extend from 24-bit
  return raw >= 0x800000 ? raw - 0x1000000 : raw;
}

/** Decode ABI-padded signed int256 from a 32-byte hex word. */
export function decodeSignedInt256(wordHex: string): bigint {
  const w = wordHex.startsWith("0x") ? wordHex.slice(2) : wordHex;
  if (w.length !== 64 || !/^[0-9a-fA-F]+$/.test(w)) {
    throw new ModifyLiquidityDecodeError("int256 word malformed", "BAD_DATA");
  }
  const unsigned = BigInt(`0x${w}`);
  const two256 = 1n << 256n;
  const signed = unsigned >= two256 / 2n ? unsigned - two256 : unsigned;
  return signed;
}

function asBlockNumber(v: bigint | number | string | undefined): number {
  if (v == null) {
    throw new ModifyLiquidityDecodeError("missing blockNumber", "MISSING_FIELDS");
  }
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    if (v.startsWith("0x")) return Number(BigInt(v));
    return Number(v);
  }
  throw new ModifyLiquidityDecodeError("bad blockNumber", "MALFORMED");
}

function asLogIndex(v: number | string | undefined): number {
  if (v == null) {
    throw new ModifyLiquidityDecodeError("missing logIndex", "MISSING_FIELDS");
  }
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    if (v.startsWith("0x")) return Number(BigInt(v));
    return Number(v);
  }
  throw new ModifyLiquidityDecodeError("bad logIndex", "MALFORMED");
}

/**
 * Strict decode with mandatory topic verification.
 * @param expectedPoolId when set, topic1 must equal this poolId
 * @param expectedSender when set, topic2 address must equal this sender
 */
export function decodeModifyLiquidityLog(
  log: RawLogLike,
  opts?: {
    expectedPoolId?: string;
    expectedSender?: string;
    poolManager?: string;
  },
): DecodedModifyLiquidity {
  const topics = log.topics ?? [];
  if (topics.length < 3) {
    throw new ModifyLiquidityDecodeError("need topics[0..2]", "MALFORMED");
  }
  const topic0 = normalizeBytes32(topics[0]!);
  if (topic0 !== MODIFY_LIQUIDITY_TOPIC0) {
    throw new ModifyLiquidityDecodeError(
      `topic0 mismatch: ${topic0}`,
      "BAD_TOPIC0",
    );
  }

  const poolId = normalizeBytes32(topics[1]!);
  if (opts?.expectedPoolId) {
    const expected = normalizeBytes32(opts.expectedPoolId);
    if (poolId !== expected) {
      throw new ModifyLiquidityDecodeError(
        `poolId topic mismatch: have ${poolId} want ${expected}`,
        "BAD_POOL",
      );
    }
  }

  let sender: string;
  try {
    sender = topicAddress(topics[2]!);
  } catch {
    throw new ModifyLiquidityDecodeError("sender topic invalid", "BAD_SENDER");
  }
  if (opts?.expectedSender) {
    if (sender.toLowerCase() !== getAddress(opts.expectedSender).toLowerCase()) {
      throw new ModifyLiquidityDecodeError(
        `sender mismatch: have ${sender} want ${opts.expectedSender}`,
        "BAD_SENDER",
      );
    }
  }

  if (opts?.poolManager && log.address) {
    if (
      getAddress(log.address).toLowerCase() !==
      getAddress(opts.poolManager).toLowerCase()
    ) {
      throw new ModifyLiquidityDecodeError(
        "log address is not PoolManager",
        "MALFORMED",
      );
    }
  }

  const data = (log.data ?? "0x").toLowerCase();
  if (!data.startsWith("0x") || data.length < 2 + 64 * 4) {
    throw new ModifyLiquidityDecodeError(
      "data must encode tickLower,tickUpper,liquidityDelta,salt",
      "BAD_DATA",
    );
  }
  const body = data.slice(2);
  const w0 = body.slice(0, 64);
  const w1 = body.slice(64, 128);
  const w2 = body.slice(128, 192);
  const w3 = body.slice(192, 256);
  if (!w0 || !w1 || !w2 || !w3) {
    throw new ModifyLiquidityDecodeError("data truncated", "BAD_DATA");
  }

  const tickLower = decodeSignedInt24(w0);
  const tickUpper = decodeSignedInt24(w1);
  const liquidityDelta = decodeSignedInt256(w2);
  const salt = normalizeBytes32(`0x${w3}`);

  if (!log.transactionHash) {
    throw new ModifyLiquidityDecodeError("missing transactionHash", "MISSING_FIELDS");
  }

  return {
    poolId,
    sender: sender.toLowerCase(),
    tickLower,
    tickUpper,
    liquidityDelta: liquidityDelta.toString(),
    salt,
    blockNumber: asBlockNumber(log.blockNumber),
    transactionHash: log.transactionHash.toLowerCase(),
    logIndex: asLogIndex(log.logIndex),
  };
}

/** Deduplicate by txHash + logIndex; preserve first-seen order. */
export function dedupeModifyLiquidityLogs(
  logs: DecodedModifyLiquidity[],
): DecodedModifyLiquidity[] {
  const seen = new Set<string>();
  const out: DecodedModifyLiquidity[] = [];
  for (const l of logs) {
    const k = `${l.transactionHash}:${l.logIndex}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

/** Filter + decode raw logs; reject false positives without throwing the batch. */
export function filterAndDecodeModifyLiquidityLogs(
  logs: RawLogLike[],
  opts: {
    expectedPoolId: string;
    expectedSender?: string;
    poolManager?: string;
  },
): {
  accepted: DecodedModifyLiquidity[];
  rejected: { reason: string; code: string }[];
} {
  const accepted: DecodedModifyLiquidity[] = [];
  const rejected: { reason: string; code: string }[] = [];
  for (const log of logs) {
    try {
      accepted.push(decodeModifyLiquidityLog(log, opts));
    } catch (e) {
      if (e instanceof ModifyLiquidityDecodeError) {
        rejected.push({ reason: e.message, code: e.code });
      } else {
        rejected.push({ reason: String(e), code: "MALFORMED" });
      }
    }
  }
  return {
    accepted: dedupeModifyLiquidityLogs(accepted),
    rejected,
  };
}

export function positionKeyId(params: {
  poolId: string;
  owner: string;
  tickLower: number;
  tickUpper: number;
  salt: string;
}): string {
  return [
    normalizeBytes32(params.poolId),
    getAddress(params.owner).toLowerCase(),
    String(params.tickLower),
    String(params.tickUpper),
    normalizeBytes32(params.salt),
  ].join("|");
}
