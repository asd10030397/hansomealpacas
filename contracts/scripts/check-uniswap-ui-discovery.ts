/**
 * Check Uniswap Web UI / Trading API discovery for UGLY v4 pool (fee 500).
 * Run: npx hardhat run scripts/check-uniswap-ui-discovery.ts --network robinhood
 */
import { formatEther, formatUnits, parseEther, parseUnits } from "ethers";
import { ethers } from "hardhat";

const POOL_ID = "0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056";
const UGLY = "0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c";
const NATIVE = "0x0000000000000000000000000000000000000000";
const TREASURY = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";
const CHAIN_ID = 4663;

const ROUTER_EXPECTED = {
  ethToUglyIn: parseEther("0.001"),
  ethToUglyOut: parseUnits("355251.053052701245329707", 18),
  uglyToEthIn: parseUnits("100000", 18),
  uglyToEthOut: parseEther("0.000277238533126947"),
};

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

async function tryTradingQuote(apiKey?: string) {
  const headers: Record<string, string> = { "x-universal-router-version": "2.0" };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const ethToUgly = await postJson(
    "https://trade-api.gateway.uniswap.org/v1/quote",
    {
      swapper: TREASURY,
      tokenIn: NATIVE,
      tokenOut: UGLY,
      tokenInChainId: CHAIN_ID,
      tokenOutChainId: CHAIN_ID,
      amount: ROUTER_EXPECTED.ethToUglyIn.toString(),
      type: "EXACT_INPUT",
      routingPreference: "BEST_PRICE",
      protocols: ["V4", "V3", "V2"],
    },
    headers,
  );

  const uglyToEth = await postJson(
    "https://trade-api.gateway.uniswap.org/v1/quote",
    {
      swapper: TREASURY,
      tokenIn: UGLY,
      tokenOut: NATIVE,
      tokenInChainId: CHAIN_ID,
      tokenOutChainId: CHAIN_ID,
      amount: ROUTER_EXPECTED.uglyToEthIn.toString(),
      type: "EXACT_INPUT",
      routingPreference: "BEST_PRICE",
      protocols: ["V4", "V3", "V2"],
    },
    headers,
  );

  return { ethToUgly, uglyToEth };
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

async function tryInterfaceGraphql() {
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
      variables: { chain: "ROBINHOOD", poolId: POOL_ID },
    },
    {
      name: "v4PoolByPoolIdAlt",
      query: `query V4Pool($chain: Chain!, $poolId: String!) {
        v4Pool(chain: $chain, poolId: $poolId) {
          id
          poolId
          feeTier
          token0 { address symbol chain }
          token1 { address symbol chain }
        }
      }`,
      variables: { chain: "UNKNOWN_CHAIN", poolId: POOL_ID },
    },
    {
      name: "searchPoolsUGLY",
      query: `query SearchPools($searchQuery: String!, $chainIds: [Int!]!) {
        searchPools(searchQuery: $searchQuery, chainIds: $chainIds, searchType: POOL) {
          poolId
          feeTier
          token0 { symbol address chain }
          token1 { symbol address chain }
          totalLiquidity { value }
        }
      }`,
      variables: { searchQuery: "UGLY", chainIds: [CHAIN_ID] },
    },
    {
      name: "tokenProjectUGLY",
      query: `query Token($chain: Chain!, $address: String!) {
        token(chain: $chain, address: $address) {
          symbol
          name
          address
          project { name logoUrl isSpam }
          market(currency: USD) { price { value } }
        }
      }`,
      variables: { chain: "ROBINHOOD", address: UGLY },
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
  console.log("Uniswap Web UI / Quote API Discovery Check");
  console.log(`  Chain ID:   ${CHAIN_ID}`);
  console.log(`  Pool ID:    ${POOL_ID}`);
  console.log(`  UGLY:       ${UGLY}`);
  console.log("");
  console.log("Router staticCall baseline (already verified):");
  console.log(`  0.001 ETH -> ${formatUnits(ROUTER_EXPECTED.ethToUglyOut, 18)} UGLY`);
  console.log(`  100000 UGLY -> ${formatEther(ROUTER_EXPECTED.uglyToEthOut)} ETH`);

  // 1-3. Interface GraphQL / indexer discovery
  console.log("");
  console.log("=== Interface GraphQL (app.uniswap.org backend) ===");
  const gql = await tryInterfaceGraphql();
  for (const item of gql) {
    console.log("");
    console.log(`Query: ${item.name} (HTTP ${item.status})`);
    console.log(JSON.stringify(item.json, null, 2).slice(0, 2000));
  }

  // 4. Trading Quote API (same backend used by swap UI)
  console.log("");
  console.log("=== Trading Quote API (trade-api.gateway.uniswap.org/v1/quote) ===");
  const apiKey = process.env.UNISWAP_API_KEY?.trim();
  const quotes = await tryTradingQuote(apiKey);
  console.log("");
  console.log("ETH -> UGLY quote API");
  console.log(`  HTTP: ${quotes.ethToUgly.status}`);
  console.log(JSON.stringify(quotes.ethToUgly.json, null, 2).slice(0, 2000));

  console.log("");
  console.log("UGLY -> ETH quote API");
  console.log(`  HTTP: ${quotes.uglyToEth.status}`);
  console.log(JSON.stringify(quotes.uglyToEth.json, null, 2).slice(0, 2000));

  if (quotes.ethToUgly.status === 200) {
    const out = extractQuoteOut(quotes.ethToUgly.json);
    console.log("");
    console.log(`Quote API ETH->UGLY amountOut: ${out !== null ? formatUnits(out, 18) : "unknown"}`);
  }
  if (quotes.uglyToEth.status === 200) {
    const out = extractQuoteOut(quotes.uglyToEth.json);
    console.log(`Quote API UGLY->ETH amountOut: ${out !== null ? formatEther(out) : "unknown"} ETH`);
  }

  console.log("");
  console.log("=== Summary ===");
  const poolFoundInGql = gql.some((g) => {
    const s = JSON.stringify(g.json);
    return s.includes(POOL_ID.slice(2, 10)) || (s.includes("UGLY") && s.includes("v4Pool") && !s.includes('"v4Pool": null'));
  });
  console.log(`  PoolId visible in Interface GraphQL: ${poolFoundInGql ? "YES" : "NO / not indexed yet"}`);
  console.log(`  Quote API accessible: ${quotes.ethToUgly.status === 200 ? "YES" : `NO (HTTP ${quotes.ethToUgly.status})`}`);
  if (!apiKey && quotes.ethToUgly.status === 401) {
    console.log("  Note: set UNISWAP_API_KEY in contracts/.env to test Quote API directly.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
