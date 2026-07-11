/**
 * Check Uniswap Web UI / Trading API discovery for the HANSOME v4 pool.
 * PoolId is computed from the pool key — no pre-known pool id is hardcoded.
 * Run: npx hardhat run scripts/check-uniswap-ui-discovery.ts --network robinhood
 */
import { formatEther, formatUnits, parseEther, parseUnits, ZeroAddress } from "ethers";
import { computePoolId } from "./lib/v4-math";
import { resolveHansomeAddress, resolveLpFee, resolveTickSpacing } from "./lib/pool-config";

const TREASURY = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";
const CHAIN_ID = 4663;

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://app.uniswap.org", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: res.status, json, text };
}

async function tryTradingQuote(hansomeAddress: string, ethIn: bigint, hansomeIn: bigint, apiKey?: string) {
  const headers: Record<string, string> = { "x-universal-router-version": "2.0" };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const ethToHansome = await postJson(
    "https://trade-api.gateway.uniswap.org/v1/quote",
    {
      swapper: TREASURY,
      tokenIn: ZeroAddress,
      tokenOut: hansomeAddress,
      tokenInChainId: CHAIN_ID,
      tokenOutChainId: CHAIN_ID,
      amount: ethIn.toString(),
      type: "EXACT_INPUT",
      routingPreference: "BEST_PRICE",
      protocols: ["V4", "V3", "V2"],
    },
    headers,
  );

  const hansomeToEth = await postJson(
    "https://trade-api.gateway.uniswap.org/v1/quote",
    {
      swapper: TREASURY,
      tokenIn: hansomeAddress,
      tokenOut: ZeroAddress,
      tokenInChainId: CHAIN_ID,
      tokenOutChainId: CHAIN_ID,
      amount: hansomeIn.toString(),
      type: "EXACT_INPUT",
      routingPreference: "BEST_PRICE",
      protocols: ["V4", "V3", "V2"],
    },
    headers,
  );

  return { ethToHansome, hansomeToEth };
}

function extractQuoteOut(data: unknown): bigint | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const obj = data as Record<string, unknown>;
  const quote = obj.quote as Record<string, unknown> | undefined;
  const output = quote?.output as Record<string, unknown> | undefined;
  const amount = output?.amount ?? quote?.quote ?? obj.outputAmount ?? obj.quoteGasAdjusted ?? null;
  if (typeof amount === "string" || typeof amount === "number") {
    return BigInt(amount);
  }
  return null;
}

async function tryInterfaceGraphql(hansomeAddress: string, poolId: string) {
  const attempts: Array<{ name: string; query: string; variables?: Record<string, unknown> }> = [
    {
      name: "v4PoolByPoolId",
      query: `query V4Pool($chain: Chain!, $poolId: String!) {
        v4Pool(chain: $chain, poolId: $poolId) {
          id
          poolId
          feeTier
          token0 { address symbol chain }
          token1 { address symbol chain }
          totalLiquidity { value }
        }
      }`,
      variables: { chain: "ROBINHOOD", poolId },
    },
    {
      name: "searchPoolsHANSOME",
      query: `query SearchPools($searchQuery: String!, $chainIds: [Int!]!) {
        searchPools(searchQuery: $searchQuery, chainIds: $chainIds, searchType: POOL) {
          poolId
          feeTier
          token0 { symbol address chain }
          token1 { symbol address chain }
          totalLiquidity { value }
        }
      }`,
      variables: { searchQuery: "HANSOME", chainIds: [CHAIN_ID] },
    },
    {
      name: "tokenProjectHANSOME",
      query: `query Token($chain: Chain!, $address: String!) {
        token(chain: $chain, address: $address) {
          symbol
          name
          address
          project { name logoUrl isSpam }
          market(currency: USD) { price { value } }
        }
      }`,
      variables: { chain: "ROBINHOOD", address: hansomeAddress },
    },
  ];

  const results = [];
  for (const attempt of attempts) {
    const res = await postJson("https://interface.gateway.uniswap.org/v1/graphql", {
      query: attempt.query,
      variables: attempt.variables,
    });
    results.push({ ...attempt, ...res });
  }
  return results;
}

async function main() {
  const hansomeAddress = resolveHansomeAddress();
  const lpFee = resolveLpFee();
  const tickSpacing = resolveTickSpacing();
  const poolId = process.env.POOL_ID?.trim() || computePoolId({
    currency0: ZeroAddress,
    currency1: hansomeAddress,
    fee: lpFee,
    tickSpacing,
    hooks: ZeroAddress,
  });

  const ethIn = process.env.TEST_ETH_AMOUNT ? parseEther(process.env.TEST_ETH_AMOUNT) : parseEther("0.001");
  const hansomeIn = process.env.TEST_HANSOME_AMOUNT ? parseUnits(process.env.TEST_HANSOME_AMOUNT, 18) : parseUnits("100000", 18);

  console.log("Uniswap Web UI / Quote API Discovery Check");
  console.log(`  Chain ID:   ${CHAIN_ID}`);
  console.log(`  Pool ID:    ${poolId}${process.env.POOL_ID ? " (from env)" : " (computed)"}`);
  console.log(`  HANSOME:    ${hansomeAddress}`);

  // 1. Interface GraphQL / indexer discovery
  console.log("");
  console.log("=== Interface GraphQL (app.uniswap.org backend) ===");
  const gql = await tryInterfaceGraphql(hansomeAddress, poolId);
  for (const item of gql) {
    console.log("");
    console.log(`Query: ${item.name} (HTTP ${item.status})`);
    console.log(JSON.stringify(item.json, null, 2).slice(0, 2000));
  }

  // 2. Trading Quote API (same backend used by swap UI)
  console.log("");
  console.log("=== Trading Quote API (trade-api.gateway.uniswap.org/v1/quote) ===");
  const apiKey = process.env.UNISWAP_API_KEY?.trim();
  const quotes = await tryTradingQuote(hansomeAddress, ethIn, hansomeIn, apiKey);
  console.log("");
  console.log("ETH -> HANSOME quote API");
  console.log(`  HTTP: ${quotes.ethToHansome.status}`);
  console.log(JSON.stringify(quotes.ethToHansome.json, null, 2).slice(0, 2000));

  console.log("");
  console.log("HANSOME -> ETH quote API");
  console.log(`  HTTP: ${quotes.hansomeToEth.status}`);
  console.log(JSON.stringify(quotes.hansomeToEth.json, null, 2).slice(0, 2000));

  if (quotes.ethToHansome.status === 200) {
    const out = extractQuoteOut(quotes.ethToHansome.json);
    console.log("");
    console.log(`Quote API ETH->HANSOME amountOut: ${out !== null ? formatUnits(out, 18) : "unknown"}`);
  }
  if (quotes.hansomeToEth.status === 200) {
    const out = extractQuoteOut(quotes.hansomeToEth.json);
    console.log(`Quote API HANSOME->ETH amountOut: ${out !== null ? formatEther(out) : "unknown"} ETH`);
  }

  console.log("");
  console.log("=== Summary ===");
  const poolFoundInGql = gql.some((g) => {
    const s = JSON.stringify(g.json);
    return s.includes(poolId.slice(2, 10)) || (s.includes("HANSOME") && s.includes("v4Pool") && !s.includes('"v4Pool": null'));
  });
  console.log(`  PoolId visible in Interface GraphQL: ${poolFoundInGql ? "YES" : "NO / not indexed yet"}`);
  console.log(`  Quote API accessible: ${quotes.ethToHansome.status === 200 ? "YES" : `NO (HTTP ${quotes.ethToHansome.status})`}`);
  if (!apiKey && quotes.ethToHansome.status === 401) {
    console.log("  Note: set UNISWAP_API_KEY in contracts/.env to test Quote API directly.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
