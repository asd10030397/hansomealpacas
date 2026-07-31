import {

  createPublicClient,

  getAddress,

  http,

  type Address,

  type PublicClient,

} from "viem";

import { DEFAULT_RPC_URL, robinhoodChain } from "@/lib/chain";

import {

  POSITION_MANAGER_ADDRESS,

  titanLockerAbi,

  TITAN_LOCKER_MANAGER,

} from "@/lib/hansome-score/constants";

import { LOCKER_REGISTRY } from "@/lib/hansome-score/lp/registry";



export type TitanLockMatch = {

  lockId: number;

  positionNftId: bigint;

  childLocker: Address;

  lockOwner: Address;

  createdAt: number;

  unlockTime: number;

  asset: Address;

};



function client(): PublicClient {

  return createPublicClient({

    chain: robinhoodChain,

    transport: http(process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL, {
      timeout: 20_000,
    }),

  });

}



const TITAN_BATCH = 24;



async function mapInBatches<T, R>(

  items: T[],

  batchSize: number,

  fn: (item: T) => Promise<R>,

): Promise<R[]> {

  const out: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {

    const chunk = items.slice(i, i + batchSize);

    out.push(...(await Promise.all(chunk.map(fn))));

  }

  return out;

}



async function readLockData(

  c: PublicClient,

  lockId: number,

): Promise<TitanLockMatch | null> {

  try {

    const d = await c.readContract({

      address: TITAN_LOCKER_MANAGER,

      abi: titanLockerAbi,

      functionName: "getTokenLockData",

      args: [lockId],

    });

    return {

      lockId,

      childLocker: getAddress(d[2]) as Address,

      lockOwner: getAddress(d[3]) as Address,

      asset: getAddress(d[4]) as Address,

      positionNftId: d[5] as bigint,

      createdAt: Number(d[7]),

      unlockTime: Number(d[8]),

    };

  } catch {

    return null;

  }

}



function dedupeByNft(matches: TitanLockMatch[]): TitanLockMatch[] {

  const byNft = new Map<string, TitanLockMatch>();

  for (const m of matches) {

    const k = m.positionNftId.toString();

    const prev = byNft.get(k);

    if (!prev || m.unlockTime > prev.unlockTime) byNft.set(k, m);

  }

  return [...byNft.values()];

}



/**

 * Discover Titan locks whose Position NFT may relate to `tokenAddress`.

 * Generic path — not HANSOME-hardcoded. Scans recent lock IDs + address indexes.

 * RPC reads are batched in parallel (was sequential — dominant when count grows).

 */

export async function discoverTitanLocksForToken(

  tokenAddress: string,

  hintAddresses: string[] = [],

): Promise<TitanLockMatch[]> {

  const c = client();

  const tokenLc = getAddress(tokenAddress).toLowerCase();

  const titan = TITAN_LOCKER_MANAGER;



  let count = 0;

  try {

    count = Number(

      await c.readContract({

        address: titan,

        abi: titanLockerAbi,

        functionName: "tokenLockerCount",

      }),

    );

  } catch {

    return [];

  }

  if (!Number.isFinite(count) || count <= 0) return [];



  const candidateLockIds = new Set<number>();

  // Newest locks first (bounded — Week 2A widened window)

  for (let i = count; i >= Math.max(1, count - 160); i--) candidateLockIds.add(i);



  const addrs = new Set<string>([

    ...hintAddresses.map((a) => a.toLowerCase()),

    ...LOCKER_REGISTRY.flatMap((l) => [

      l.managerAddress.toLowerCase(),

      ...l.knownChildAddresses.map((x) => x.toLowerCase()),

    ]),

  ]);



  await mapInBatches([...addrs], TITAN_BATCH, async (addr) => {

    try {

      const ids = (await c.readContract({

        address: titan,

        abi: titanLockerAbi,

        functionName: "getTokenLockersForAddress",

        args: [getAddress(addr) as Address],

      })) as unknown as readonly (bigint | number)[];

      for (const id of ids) candidateLockIds.add(Number(id));

    } catch {

      /* ignore */

    }

    return null;

  });



  const rows = await mapInBatches(

    [...candidateLockIds],

    TITAN_BATCH,

    (lockId) => readLockData(c, lockId),

  );



  const matches: TitanLockMatch[] = [];

  for (const m of rows) {

    if (!m) continue;

    const assetIsPm = m.asset.toLowerCase() === POSITION_MANAGER_ADDRESS.toLowerCase();

    if (!assetIsPm && m.asset.toLowerCase() !== tokenLc) continue;

    matches.push(m);

  }



  return dedupeByNft(matches);

}



/**

 * Resolve Titan lock(s) for specific Position NFT IDs without requiring token filter.

 * Scans the full locker count (batched) — cheap while count stays small (~tens).

 */

export async function lookupTitanLocksByPositionIds(

  positionNftIds: bigint[],

): Promise<Map<string, TitanLockMatch>> {

  const wanted = new Set(positionNftIds.map((id) => id.toString()));

  if (wanted.size === 0) return new Map();



  const c = client();

  let count = 0;

  try {

    count = Number(

      await c.readContract({

        address: TITAN_LOCKER_MANAGER,

        abi: titanLockerAbi,

        functionName: "tokenLockerCount",

      }),

    );

  } catch {

    return new Map();

  }

  if (!Number.isFinite(count) || count <= 0) return new Map();



  const ids = Array.from({ length: count }, (_, i) => i + 1);

  const rows = await mapInBatches(ids, TITAN_BATCH, (lockId) => readLockData(c, lockId));

  const out = new Map<string, TitanLockMatch>();

  for (const m of rows) {

    if (!m) continue;

    const key = m.positionNftId.toString();

    if (!wanted.has(key)) continue;

    const prev = out.get(key);

    if (!prev || m.unlockTime > prev.unlockTime) out.set(key, m);

  }

  return out;

}



export async function lookupTitanLockByPositionId(

  positionNftId: bigint,

): Promise<TitanLockMatch | null> {

  const map = await lookupTitanLocksByPositionIds([positionNftId]);

  return map.get(positionNftId.toString()) ?? null;

}


