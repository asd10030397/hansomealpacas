import { AbiCoder, keccak256, ZeroAddress } from "ethers";

const HANSOME = process.env.HANSOME_ALPACAS_ADDRESS?.trim() || "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";
const LP_FEE = process.env.POOL_FEE ? Number(process.env.POOL_FEE) : 500;
const TICK_SPACING = process.env.POOL_TICK_SPACING ? Number(process.env.POOL_TICK_SPACING) : 10;
const GQL = "https://interface.gateway.uniswap.org/v1/graphql";

function computePoolId({ currency0, currency1, fee, tickSpacing, hooks }) {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [currency0, currency1, fee, tickSpacing, hooks],
  );
  return keccak256(encoded);
}

const POOL_ID =
  process.env.POOL_ID?.trim() ||
  computePoolId({ currency0: ZeroAddress, currency1: HANSOME, fee: LP_FEE, tickSpacing: TICK_SPACING, hooks: ZeroAddress });

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

console.log(`HANSOME: ${HANSOME}`);
console.log(`PoolId:  ${POOL_ID}${process.env.POOL_ID ? " (from env)" : " (computed)"}`);
console.log("");

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
        tokenIn: ZeroAddress,
        tokenOut: HANSOME,
        amount: "1000000000000000",
        type: "EXACT_INPUT",
        routingPreference: "BEST_PRICE",
      },
    },
  ],
  [
    "tradingApiQuote",
    `query { tradingApiQuote(chain: ROBINHOOD, tokenIn: "${ZeroAddress}", tokenOut: "${HANSOME}", amount: "1000000000000000", type: EXACT_INPUT) { outputAmount routeString } }`,
    undefined,
  ],
]) {
  await gql(name, query, variables);
}
