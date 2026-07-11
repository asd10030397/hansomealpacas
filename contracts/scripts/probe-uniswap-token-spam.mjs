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

async function gql(query, variables) {
  const r = await fetch(GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://app.uniswap.org" },
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

const poolQuery = `query V4Pool($chain: Chain!, $poolId: String!) {
  v4Pool(chain: $chain, poolId: $poolId) {
    poolId feeTier totalLiquidity { value }
    token0 { symbol } token1 { symbol }
  }
}`;

const data = await gql(poolQuery, { chain: "ROBINHOOD", poolId: POOL_ID });
console.log("hansomePool", JSON.stringify(data, null, 2));

const token = await gql(
  `query Token($chain: Chain!, $address: String!) {
    token(chain: $chain, address: $address) {
      symbol name address
      project { isSpam safetyLevel logoUrl name }
      market(currency: USD) { price { value } totalValueLocked { value } }
    }
  }`,
  { chain: "ROBINHOOD", address: HANSOME },
);
console.log("token", JSON.stringify(token, null, 2));
