const POOL_500 = "0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056";
const POOL_3000 = "0x25d3614484fc23f4176097e78158f461f6bb324db9594837e83396a5f3d8e983";
const UGLY = "0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c";
const GQL = "https://interface.gateway.uniswap.org/v1/graphql";

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

for (const [label, poolId] of [["fee500", POOL_500], ["fee3000_broken", POOL_3000]]) {
  const data = await gql(poolQuery, { chain: "ROBINHOOD", poolId });
  console.log(label, JSON.stringify(data, null, 2));
}

const token = await gql(
  `query Token($chain: Chain!, $address: String!) {
    token(chain: $chain, address: $address) {
      symbol name address
      project { isSpam safetyLevel logoUrl name }
      market(currency: USD) { price { value } totalValueLocked { value } }
    }
  }`,
  { chain: "ROBINHOOD", address: UGLY },
);
console.log("token", JSON.stringify(token, null, 2));
