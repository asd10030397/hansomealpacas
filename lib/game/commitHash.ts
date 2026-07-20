/**
 * Pure commitment hash helper — safe for client and server.
 * No storage, no Node builtins.
 */

import { encodePacked, keccak256, type Hex } from "viem";
import type { LocationId } from "@/types/game";

export function computeCommitHash(
  tokenId: number,
  day: number,
  locationId: LocationId,
  salt: Hex,
): Hex {
  return keccak256(
    encodePacked(
      ["uint256", "uint256", "uint8", "bytes32"],
      [BigInt(tokenId), BigInt(day), locationId, salt],
    ),
  );
}
