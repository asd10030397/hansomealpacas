import {

  createPublicClient,

  getAddress,

  http,

  type Address,

  type PublicClient,

} from "viem";

import { DEFAULT_RPC_URL, robinhoodChain } from "@/lib/chain";

import {

  RH_QUOTE_TOKEN_LIST,

  UNISWAP_RH_DEPLOYMENTS,

} from "@/lib/hansome-score/lp/deployments";

import {

  syntheticUnknownPosition,

  type VersionDiscoveryResult,

  type VersionPoolHit,

} from "@/lib/hansome-score/lp/adapters/types";

import {

  classifyPoolInventoryMateriality,

  isPresentationMaterial,

  type PoolInventoryMateriality,

} from "@/lib/hansome-score/lp/pool-materiality";



const getPairAbi = [

  {

    type: "function",

    name: "getPair",

    stateMutability: "view",

    inputs: [

      { name: "tokenA", type: "address" },

      { name: "tokenB", type: "address" },

    ],

    outputs: [{ type: "address" }],

  },

] as const;



const erc20BalanceAbi = [

  {

    type: "function",

    name: "balanceOf",

    stateMutability: "view",

    inputs: [{ name: "account", type: "address" }],

    outputs: [{ type: "uint256" }],

  },

] as const;



function client(): PublicClient {

  return createPublicClient({

    chain: robinhoodChain,

    transport: http(process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL, {
      timeout: 20_000,
    }),

  });

}



const ZERO = "0x0000000000000000000000000000000000000000";



async function readBalance(

  c: PublicClient,

  token: Address,

  account: Address,

): Promise<bigint | null> {

  try {

    return (await c.readContract({

      address: token,

      abi: erc20BalanceAbi,

      functionName: "balanceOf",

      args: [account],

    })) as bigint;

  } catch {

    return null;

  }

}



function countByMateriality(

  pools: VersionPoolHit[],

): Record<PoolInventoryMateriality, number> {

  const out: Record<PoolInventoryMateriality, number> = {

    material: 0,

    dust: 0,

    inventory_unknown: 0,

  };

  for (const p of pools) {

    const m = p.materiality ?? "inventory_unknown";

    out[m] += 1;

  }

  return out;

}



/**

 * Uniswap v2 adapter — pair discovery via factory.getPair for quote tokens.

 * LP token ownership / burn / locker decode: not reliable yet → synthetic

 * unknown slots only for reliably material pair inventory.

 */

export async function discoverV2Liquidity(params: {

  tokenAddress: string;

  client?: PublicClient;

}): Promise<VersionDiscoveryResult> {

  const dep = UNISWAP_RH_DEPLOYMENTS.v2;

  const c = params.client ?? client();

  const token = getAddress(params.tokenAddress) as Address;



  const pools: VersionDiscoveryResult["pools"] = [];

  const positions: VersionDiscoveryResult["positions"] = [];



  try {

    for (const quote of RH_QUOTE_TOKEN_LIST) {

      if (quote.toLowerCase() === token.toLowerCase()) continue;

      let pair: Address;

      try {

        pair = (await c.readContract({

          address: dep.factory,

          abi: getPairAbi,

          functionName: "getPair",

          args: [token, quote],

        })) as Address;

      } catch {

        continue;

      }

      if (!pair || pair.toLowerCase() === ZERO) continue;



      const tokenBal = await readBalance(c, token, pair);

      const quoteBal = await readBalance(c, quote, pair);

      const materiality = classifyPoolInventoryMateriality({

        tokenBalance: tokenBal,

        quoteBalance: quoteBal,

      });



      pools.push({

        version: "v2",

        poolOrPair: getAddress(pair),

        quoteToken: quote,

        fee: null,

        tokenBalanceRaw: tokenBal?.toString() ?? null,

        quoteBalanceRaw: quoteBal?.toString() ?? null,

        materiality,

      });



      if (!isPresentationMaterial(materiality)) continue;



      positions.push(

        syntheticUnknownPosition({

          id: `v2-pair:${getAddress(pair)}`,

          version: "v2",

          poolOrPair: getAddress(pair),

          currency0: token,

          currency1: quote,

          dataSource: "uniswap_v2_factory.getPair — LP ownership/locker not decoded",

        }),

      );

    }

  } catch (e) {

    return {

      version: "v2",

      protocolSupportStatus: dep.protocolSupportStatus,

      searched: true,

      discoveryComplete: false,

      lockAnalysisComplete: false,

      pools: [],

      positions: [],

      detail: `v2 probe error: ${e instanceof Error ? e.message : "unknown"}`,

      evidenceLevel: "unavailable",

    };

  }



  const counts = countByMateriality(pools);

  const discovered = pools.length;

  const needsLockAnalysis =

    counts.material > 0 || counts.inventory_unknown > 0;



  return {

    version: "v2",

    protocolSupportStatus: dep.protocolSupportStatus,

    searched: true,

    discoveryComplete: true,

    lockAnalysisComplete: !needsLockAnalysis,

    pools,

    positions,

    detail:

      discovered === 0

        ? "v2: no pairs for quote set (WETH, USDG)."

        : `v2: ${discovered} discovered pair(s) via factory.getPair (material=${counts.material}, dust=${counts.dust}, inventory_unknown=${counts.inventory_unknown}) — LP ownership/locker analysis incomplete for material/unknown.`,

    evidenceLevel: discovered > 0 ? "on_chain_partial" : "on_chain_verified",

  };

}


