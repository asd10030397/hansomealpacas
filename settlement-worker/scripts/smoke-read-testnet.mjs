/**
 * Read-only Testnet smoke — no private keys required.
 *   node scripts/smoke-read-testnet.mjs
 */
import { createPublicClient, http, parseAbi } from "viem";

const RPC = process.env.RPC_URL || "https://rpc.testnet.chain.robinhood.com";
const GAME = "0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5";
const RAND = "0x45F9FFaC891e06E83a5A315E4fE1B55E5b6b438F";

const abi = parseAbi([
  "function dayZero() view returns (uint256)",
  "function dayLength() view returns (uint256)",
  "function commitDuration() view returns (uint256)",
  "function revealDuration() view returns (uint256)",
  "function currentDay() view returns (uint256)",
  "function randomness() view returns (address)",
  "function creditProgress(uint256) view returns (uint256,uint256,bool,bool)",
  "function hasDaySeed(uint256) view returns (bool)",
  "function randomnessProvider() view returns (address)",
]);

const client = createPublicClient({ transport: http(RPC) });
const chainId = await client.getChainId();
if (chainId !== 46630) throw new Error(`Expected 46630, got ${chainId}`);

const dayZero = Number(await client.readContract({ address: GAME, abi, functionName: "dayZero" }));
const dayLength = Number(await client.readContract({ address: GAME, abi, functionName: "dayLength" }));
const commitDuration = Number(await client.readContract({ address: GAME, abi, functionName: "commitDuration" }));
const revealDuration = Number(await client.readContract({ address: GAME, abi, functionName: "revealDuration" }));
const currentDay = Number(await client.readContract({ address: GAME, abi, functionName: "currentDay" }));
const randomness = await client.readContract({ address: GAME, abi, functionName: "randomness" });
const provider = await client.readContract({ address: RAND, abi, functionName: "randomnessProvider" });
const hasSeed = await client.readContract({
  address: RAND,
  abi,
  functionName: "hasDaySeed",
  args: [BigInt(currentDay)],
});
const progress = await client.readContract({
  address: GAME,
  abi,
  functionName: "creditProgress",
  args: [BigInt(currentDay)],
});

const block = await client.getBlock({ blockTag: "latest" });
const now = Number(block.timestamp);
const dayStart = dayZero + currentDay * dayLength;
const commitEnd = dayStart + commitDuration;
const revealEnd = commitEnd + revealDuration;

console.log(
  JSON.stringify(
    {
      pass: randomness.toLowerCase() === RAND.toLowerCase(),
      chainId,
      currentDay,
      now,
      commitEnd,
      revealEnd,
      settleEligibleContractTestnet: now >= commitEnd,
      settleEligibleWorker: now >= revealEnd,
      hasDaySeed: hasSeed,
      randomnessProvider: provider,
      creditProgress: {
        cursor: progress[0].toString(),
        total: progress[1].toString(),
        finalized: progress[2],
        settled: progress[3],
      },
    },
    null,
    2,
  ),
);
