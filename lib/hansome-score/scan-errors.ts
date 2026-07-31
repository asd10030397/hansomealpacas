import type { BlockscoutTokenInfo } from "@/lib/hansome-score/blockscout";
import type { RpcTokenMeta } from "@/lib/hansome-score/rpc";

export type ScanErrorCode = "invalid_address" | "token_not_found";

export const SCAN_ERROR_MESSAGES = {
  invalid_address: "Invalid token address",
  token_not_found:
    "No supported token contract was found at this address on Robinhood Chain.",
} as const;

export class ScanRequestError extends Error {
  readonly code: ScanErrorCode;

  constructor(code: ScanErrorCode, message?: string) {
    super(message ?? SCAN_ERROR_MESSAGES[code]);
    this.name = "ScanRequestError";
    this.code = code;
  }
}

function hasRpcTokenSignal(rpc: RpcTokenMeta): boolean {
  return (
    rpc.decimals != null ||
    rpc.symbol != null ||
    rpc.name != null ||
    rpc.totalSupply != null
  );
}

function hasBlockscoutTokenSignal(bsToken: BlockscoutTokenInfo | null): boolean {
  if (!bsToken) return false;
  return (
    bsToken.decimals != null ||
    bsToken.symbol != null ||
    bsToken.name != null ||
    bsToken.totalSupply != null
  );
}

/**
 * Fail closed only when RPC bytecode was readable and there is no ERC-20 / token signal.
 * If bytecode lookup failed (RPC outage), do not classify as token_not_found.
 */
export function assertSupportedTokenPresent(input: {
  /** `null` = RPC bytecode call failed; otherwise hex bytecode (empty = no contract). */
  bytecode: string | null;
  rpc: RpcTokenMeta;
  bsToken: BlockscoutTokenInfo | null;
}): void {
  if (input.bytecode == null) return;

  const noCode =
    input.bytecode === "" ||
    input.bytecode === "0x" ||
    input.bytecode === "0x0";

  if (noCode) {
    throw new ScanRequestError("token_not_found");
  }

  if (!hasRpcTokenSignal(input.rpc) && !hasBlockscoutTokenSignal(input.bsToken)) {
    throw new ScanRequestError("token_not_found");
  }
}

export function scanErrorCodeFromUnknown(error: unknown): ScanErrorCode | undefined {
  if (error instanceof ScanRequestError) return error.code;
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return scanErrorCodeFromMessage(message);
}

export function scanErrorCodeFromMessage(message: string): ScanErrorCode | undefined {
  const m = message.toLowerCase();
  if (
    m.includes("no supported token contract") ||
    m.includes("token_not_found")
  ) {
    return "token_not_found";
  }
  if (
    m.includes("invalid token address") ||
    m.includes("invalid address") ||
    m.includes("is invalid")
  ) {
    return "invalid_address";
  }
  return undefined;
}

export function httpStatusForScanError(error: unknown): number {
  const code = scanErrorCodeFromUnknown(error);
  if (code === "invalid_address") return 400;
  if (code === "token_not_found") return 404;
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (message.toLowerCase().includes("refresh in progress")) return 503;
  return 500;
}

export function scanErrorJson(error: unknown): {
  error: string;
  code?: ScanErrorCode;
} {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Failed to scan token";
  const code =
    error instanceof ScanRequestError
      ? error.code
      : scanErrorCodeFromMessage(message);
  return code ? { error: message, code } : { error: message };
}
