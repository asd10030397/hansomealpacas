const POOL_ID = "0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056";
const UGLY = "0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c";
const NATIVE = "0x0000000000000000000000000000000000000000";
const GQL = "https://interface.gateway.uniswap.org/v1/graphql";

async function gql(name, query, variables) {
  const r = await fetch(GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://app.uniswap.org" },
    body: JSON.stringify({ query, variables }),
  });
  const text = await r.text();
  console.log(`=== ${name} HTTP ${r.status} ===`);
  console.log(text.slice(0, 2500));
  console.log("");
}

await gql(
  "v4PoolsList",
  `query {
    v4Pools(chain: ROBINHOOD, first: 10, orderBy: TOTAL_LIQUIDITY, orderDirection: DESC) {
      poolId
      feeTier
      token0 { symbol address }
      token1 { symbol address }
      totalLiquidity { value }
    }
  }`,
);

await gql(
  "v4PoolById",
  `query V4Pool($chain: Chain!, $poolId: String!) {
    v4Pool(chain: $chain, poolId: $poolId) {
      poolId feeTier totalLiquidity { value }
      token0 { symbol address } token1 { symbol address }
    }
  }`,
  { chain: "ROBINHOOD", poolId: POOL_ID },
);

// Try common quote field names used by interface
for (const [name, query, variables] of [
  [
    "quoteField",
    `query Quote($input: QuoteInput!) { quote(input: $input) { quote outputAmount inputAmount routeString } }`,
    {
      input: {
        chain: "ROBINHOOD",
        tokenIn: NATIVE,
        tokenOut: UGLY,
        amount: "1000000000000000",
        type: "EXACT_INPUT",
        routingPreference: "BEST_PRICE",
      },
    },
  ],
  [
    "tradingApiQuote",
    `query { tradingApiQuote(chain: ROBINHOOD, tokenIn: "${NATIVE}", tokenOut: "${UGLY}", amount: "1000000000000000", type: EXACT_INPUT) { outputAmount routeString } }`,
    undefined,
  ],
]) {
  await gql(name, query, variables);
}
