import { describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { PONS_LAUNCH_LOCKER } from "@/lib/hansome-score/constants";
import { discoverV3Liquidity } from "@/lib/hansome-score/lp/adapters/v3";
import { RH_QUOTE_TOKENS, UNISWAP_RH_DEPLOYMENTS } from "@/lib/hansome-score/lp/deployments";

const FOX = getAddress("0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1");
const FOX_WETH = getAddress("0x9C49F21aDDa14AF527BC56C2a8fAb854F6248685");
const FOX_USDG = getAddress("0x765657607a7e1a0D822513c0233F2fEE793D6ed0");
const ZERO = "0x0000000000000000000000000000000000000000";

type Call = {
  address: string;
  functionName: string;
  args?: readonly unknown[];
};

/**
 * Fixture client: factory discovers FOX/WETH (material) + FOX/USDG (1 wei dust).
 * Proves presentation stubs omit dust even when both pools are discovered.
 */
function foxFixtureClient(opts?: {
  /** When true, USDG scanned-token balanceOf throws → inventory_unknown (no stub). */
  usdgBalanceThrows?: boolean;
}) {
  return {
    getBytecode: vi.fn(async () => "0x"),
    readContract: vi.fn(async ({ address, functionName, args }: Call) => {
      const addr = String(address).toLowerCase();
      const a0 = args?.[0] != null ? String(args[0]).toLowerCase() : "";
      const a1 = args?.[1] != null ? String(args[1]).toLowerCase() : "";
      const fee = args?.[2];

      if (
        addr === UNISWAP_RH_DEPLOYMENTS.v3.factory.toLowerCase() &&
        functionName === "getPool"
      ) {
        const quotes = new Set([
          RH_QUOTE_TOKENS.WETH.toLowerCase(),
          RH_QUOTE_TOKENS.USDG.toLowerCase(),
        ]);
        const isFoxPair =
          (a0 === FOX.toLowerCase() && quotes.has(a1)) ||
          (a1 === FOX.toLowerCase() && quotes.has(a0));
        if (!isFoxPair) return ZERO;
        const quote = a0 === FOX.toLowerCase() ? a1 : a0;
        if (quote === RH_QUOTE_TOKENS.WETH.toLowerCase() && fee === 10000) {
          return FOX_WETH;
        }
        if (quote === RH_QUOTE_TOKENS.USDG.toLowerCase() && fee === 500) {
          return FOX_USDG;
        }
        return ZERO;
      }

      if (functionName === "balanceOf") {
        const account = a0;
        if (addr === FOX.toLowerCase()) {
          if (account === FOX_WETH.toLowerCase()) {
            return 69698871398667624951837075n;
          }
          if (account === FOX_USDG.toLowerCase()) {
            if (opts?.usdgBalanceThrows) {
              throw new Error("rpc balanceOf failed");
            }
            return 1n;
          }
        }
        if (addr === RH_QUOTE_TOKENS.WETH.toLowerCase()) {
          if (account === FOX_WETH.toLowerCase()) return 10n ** 18n;
        }
        if (addr === RH_QUOTE_TOKENS.USDG.toLowerCase()) {
          if (account === FOX_USDG.toLowerCase()) return 1n;
        }
        return 0n;
      }

      // Non-Pons tokens: getLaunchedToken.exists=false → keep synthetic stub / Unknown.
      if (
        addr === PONS_LAUNCH_LOCKER.toLowerCase() &&
        functionName === "getLaunchedToken"
      ) {
        return {
          token: a0,
          deployer: ZERO,
          pairedToken: ZERO,
          positionManager: UNISWAP_RH_DEPLOYMENTS.v3.positionManager,
          positionId: 0n,
          dexId: 0n,
          launchConfigId: 0n,
          restrictionsEndBlock: 0n,
          supply: 0n,
          isToken0: false,
          poolFee: 0,
          exists: false,
          initialBuyAmount: 0n,
        };
      }

      throw new Error(`unexpected readContract ${functionName} @ ${address}`);
    }),
  };
}

describe("discoverV3Liquidity — dust vs material presentation", () => {
  it("discovers 2 FOX pools but emits only 1 material presentation stub", async () => {
    const result = await discoverV3Liquidity({
      tokenAddress: FOX,
      client: foxFixtureClient() as never,
    });

    expect(result.pools).toHaveLength(2);
    expect(result.positions).toHaveLength(1);

    const byPool = new Map(result.pools.map((p) => [p.poolOrPair.toLowerCase(), p]));
    expect(byPool.get(FOX_WETH.toLowerCase())?.materiality).toBe("material");
    expect(byPool.get(FOX_USDG.toLowerCase())?.materiality).toBe("dust");
    expect(byPool.get(FOX_USDG.toLowerCase())?.tokenBalanceRaw).toBe("1");

    expect(result.positions[0].poolId?.toLowerCase()).toBe(FOX_WETH.toLowerCase());
    expect(result.positions[0].lockState).toBe("UNABLE_TO_DETERMINE");
    expect(result.detail).toMatch(/material=1/);
    expect(result.detail).toMatch(/dust=1/);
  });

  it("inventory read failure → inventory_unknown, not a presentation stub", async () => {
    const result = await discoverV3Liquidity({
      tokenAddress: FOX,
      client: foxFixtureClient({ usdgBalanceThrows: true }) as never,
    });

    expect(result.pools).toHaveLength(2);
    const usdg = result.pools.find(
      (p) => p.poolOrPair.toLowerCase() === FOX_USDG.toLowerCase(),
    );
    expect(usdg?.materiality).toBe("inventory_unknown");
    expect(usdg?.tokenBalanceRaw).toBeNull();
    // Still only the material WETH stub — null no longer auto-keeps dust as a card.
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].poolId?.toLowerCase()).toBe(FOX_WETH.toLowerCase());
    expect(result.lockAnalysisComplete).toBe(false);
  });
});
