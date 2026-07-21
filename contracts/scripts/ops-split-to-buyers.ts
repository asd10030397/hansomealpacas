/**
 * Split HANSOME (and optional ETH) from SOURCE wallet evenly to 5 buyer wallets.
 *
 * Env (contracts/.env):
 *   SOURCE_PRIVATE_KEY
 *   SOURCE_EXPECTED_ADDRESS=0x9ddf0367cc903e20140c7271E4596b534003feA4
 *   BUYER_1_PRIVATE_KEY ... BUYER_5_PRIVATE_KEY
 *   SPLIT_HANSOME_AMOUNT=   (optional; empty = full balance / 5)
 *   SPLIT_ETH_TOTAL=        (optional; total ETH to split / 5)
 *   SOURCE_ETH_GAS_RESERVE=0.01
 *   DRY_RUN=1
 *
 * Run:
 *   DRY_RUN=1 npx hardhat run scripts/ops-split-to-buyers.ts --network robinhood
 *   npx hardhat run scripts/ops-split-to-buyers.ts --network robinhood
 */
import { Contract, Wallet, formatEther, formatUnits, parseEther, parseUnits } from "ethers";
import { ethers, network } from "hardhat";
import { resolveHansomeAddress } from "./lib/pool-config";

const ROBINHOOD_CHAIN_ID = 4663;

function requireEnv(name: string): string {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`Missing ${name} in contracts/.env`);
  return raw;
}

function walletFromEnv(envName: string): Wallet {
  const raw = requireEnv(envName);
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  try {
    return new Wallet(normalized, ethers.provider);
  } catch {
    throw new Error(`${envName} is not a valid private key (details withheld).`);
  }
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected ${ROBINHOOD_CHAIN_ID}, got ${chainId}`);
  }

  const isDryRun = process.env.DRY_RUN === "1";
  const source = walletFromEnv("SOURCE_PRIVATE_KEY");
  const sourceAddr = await source.getAddress();
  const expected = process.env.SOURCE_EXPECTED_ADDRESS?.trim();
  if (expected && sourceAddr.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`SOURCE key derives ${sourceAddr}, expected ${expected}`);
  }

  const buyers: Wallet[] = [];
  for (let i = 1; i <= 5; i++) {
    buyers.push(walletFromEnv(`BUYER_${i}_PRIVATE_KEY`));
  }
  const buyerAddrs = await Promise.all(buyers.map((b) => b.getAddress()));

  const hansomeAddress = resolveHansomeAddress();
  const hansome = new Contract(
    hansomeAddress,
    [
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
    ],
    source,
  );

  const [decimals, symbol, hansomeBal, ethBal] = await Promise.all([
    hansome.decimals() as Promise<number>,
    hansome.symbol() as Promise<string>,
    hansome.balanceOf(sourceAddr) as Promise<bigint>,
    ethers.provider.getBalance(sourceAddr),
  ]);

  const splitHansomeEnv = process.env.SPLIT_HANSOME_AMOUNT?.trim();
  let totalHansome: bigint;
  if (splitHansomeEnv) {
    totalHansome = parseUnits(splitHansomeEnv, decimals);
    if (totalHansome > hansomeBal) {
      throw new Error(`SPLIT_HANSOME_AMOUNT ${splitHansomeEnv} > balance ${formatUnits(hansomeBal, decimals)}`);
    }
  } else {
    totalHansome = hansomeBal;
  }

  const perHansome = totalHansome / 5n;
  const hansomeDust = totalHansome - perHansome * 5n;

  const splitEthEnv = process.env.SPLIT_ETH_TOTAL?.trim();
  const gasReserve = parseEther(process.env.SOURCE_ETH_GAS_RESERVE?.trim() || "0.01");
  let perEth = 0n;
  if (splitEthEnv) {
    const totalEth = parseEther(splitEthEnv);
    perEth = totalEth / 5n;
    if (ethBal < totalEth + gasReserve) {
      throw new Error(
        `Need ${formatEther(totalEth + gasReserve)} ETH on source (split + reserve), have ${formatEther(ethBal)}`,
      );
    }
  }

  console.log("Split source → 5 buyers");
  console.log(`  Network:  ${network.name} (${chainId})`);
  console.log(`  Source:   ${sourceAddr}`);
  console.log(`  Token:    ${symbol} ${hansomeAddress}`);
  console.log(`  Mode:     ${isDryRun ? "DRY_RUN" : "LIVE"}`);
  console.log("");
  console.log("Buyers:");
  for (let i = 0; i < 5; i++) {
    console.log(`  ${i + 1}. ${buyerAddrs[i]}`);
  }
  console.log("");
  console.log("HANSOME split");
  console.log(`  Source balance: ${formatUnits(hansomeBal, decimals)}`);
  console.log(`  Total to split: ${formatUnits(totalHansome, decimals)}`);
  console.log(`  Per buyer:      ${formatUnits(perHansome, decimals)}`);
  if (hansomeDust > 0n) console.log(`  Dust left:     ${formatUnits(hansomeDust, decimals)}`);
  if (perEth > 0n) {
    console.log("ETH split");
    console.log(`  Per buyer:      ${formatEther(perEth)}`);
    console.log(`  Source reserve: ${formatEther(gasReserve)}`);
  }
  console.log(`  Source ETH now: ${formatEther(ethBal)}`);

  if (perHansome === 0n && perEth === 0n) {
    throw new Error("Nothing to split — HANSOME per buyer is 0 and SPLIT_ETH_TOTAL unset");
  }

  if (isDryRun) {
    console.log("");
    console.log("DRY_RUN — no transfers sent.");
    return;
  }

  for (let i = 0; i < 5; i++) {
    const to = buyerAddrs[i]!;
    if (perHansome > 0n) {
      console.log(`Transfer HANSOME → buyer ${i + 1}...`);
      const tx = await hansome.transfer(to, perHansome);
      await tx.wait();
      console.log(`  ${tx.hash}`);
    }
    if (perEth > 0n) {
      console.log(`Transfer ETH → buyer ${i + 1}...`);
      const tx = await source.sendTransaction({ to, value: perEth });
      await tx.wait();
      console.log(`  ${tx.hash}`);
    }
  }

  console.log("");
  console.log("Split complete.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
