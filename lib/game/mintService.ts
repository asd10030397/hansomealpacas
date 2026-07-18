import { MOCK_MINT } from "@/data/game/mock";
import type { MintSaleState } from "@/types/game";

/**
 * Typed mint service (mock).
 * TODO(contract): replace with HansomeGenesisNFT reads (wagmi/viem).
 * Do not invent contract addresses here.
 */

export async function fetchMintSaleState(): Promise<MintSaleState> {
  return { ...MOCK_MINT };
}

export type MockMintTxState = "idle" | "preparing" | "awaiting_wallet" | "error";

export interface MockMintRequest {
  quantity: number;
  phase: MintSaleState["phase"];
}

/**
 * Does NOT simulate a successful on-chain mint.
 * Returns an explicit mock error so UI never fakes confirmation.
 */
export async function requestMockMint(req: MockMintRequest): Promise<{
  ok: false;
  state: MockMintTxState;
  message: string;
}> {
  void req;
  return {
    ok: false,
    state: "error",
    message:
      "Mint is not connected to a contract yet. This is a UI demo — no transaction was sent.",
  };
}
