import {
  encodeAbiParameters,
  encodePacked,
  zeroAddress,
} from "viem";
import { POOL_KEY, UGLY_TOKEN_ADDRESS } from "@/lib/chain";

const poolKeyAbi = {
  type: "tuple",
  components: [
    { type: "address", name: "currency0" },
    { type: "address", name: "currency1" },
    { type: "uint24", name: "fee" },
    { type: "int24", name: "tickSpacing" },
    { type: "address", name: "hooks" },
  ],
} as const;

function toPoolKeyStruct() {
  const [currency0, currency1, fee, tickSpacing, hooks] = POOL_KEY;
  return { currency0, currency1, fee, tickSpacing, hooks };
}

export function buildEthToUglyInput(amountIn: bigint, amountOutMin = 0n): `0x${string}` {
  const actions = encodePacked(["uint8", "uint8", "uint8"], [0x06, 0x0c, 0x0f]);
  const params = [
    encodeAbiParameters(
      [poolKeyAbi, { type: "bool" }, { type: "uint128" }, { type: "uint128" }, { type: "uint256" }, { type: "bytes" }],
      [toPoolKeyStruct(), true, amountIn, amountOutMin, 0n, "0x"],
    ),
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      [zeroAddress, amountIn],
    ),
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      [UGLY_TOKEN_ADDRESS, amountOutMin],
    ),
  ];

  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, params],
  );
}

export function buildUglyToEthInput(amountIn: bigint, amountOutMin = 0n): `0x${string}` {
  const actions = encodePacked(["uint8", "uint8", "uint8"], [0x06, 0x0b, 0x0f]);
  const params = [
    encodeAbiParameters(
      [poolKeyAbi, { type: "bool" }, { type: "uint128" }, { type: "uint128" }, { type: "uint256" }, { type: "bytes" }],
      [toPoolKeyStruct(), false, amountIn, amountOutMin, 0n, "0x"],
    ),
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "bool" }],
      [UGLY_TOKEN_ADDRESS, amountIn, true],
    ),
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      [zeroAddress, amountOutMin],
    ),
  ];

  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, params],
  );
}

export function buildUniversalRouterCalldata(
  direction: "ethToUgly" | "uglyToEth",
  amountIn: bigint,
  amountOutMin: bigint,
  deadline: bigint,
) {
  const commands = encodePacked(["uint8"], [0x10]) as `0x${string}`;
  const input =
    direction === "ethToUgly"
      ? buildEthToUglyInput(amountIn, amountOutMin)
      : buildUglyToEthInput(amountIn, amountOutMin);

  return {
    commands,
    inputs: [input] as readonly `0x${string}`[],
    deadline,
    value: direction === "ethToUgly" ? amountIn : 0n,
  };
}
