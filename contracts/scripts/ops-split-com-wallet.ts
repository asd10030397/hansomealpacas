/**
 * Split HANSOME from COM_WALLET evenly to COM_WALLET_1..4.
 *
 * Env:
 *   COM_WALLET_PRIVATE_KEY
 *   COM_WALLET_1_PRIVATE_KEY ... COM_WALLET_4_PRIVATE_KEY
 *   SPLIT_HANSOME_AMOUNT=   (optional; empty = full COM balance / 4)
 *   DRY_RUN=1
 *
 * Run:
 *   DRY_RUN=1 npx hardhat run scripts/ops-split-com-wallet.ts --network robinhood
 *   npx hardhat run scripts/ops-split-com-wallet.ts --network robinhood
 */
import { Contract, Wallet, formatEther, formatUnits, parseUnits } from "ethers";
import { ethers, network } from "hardhat";
import { resolveHansomeAddress } from "./lib/pool-config";

const ROBINHOOD_CHAIN_ID = 4663;
const N = 4;

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
  const source = walletFromEnv("COM_WALLET_PRIVATE_KEY");
  const sourceAddr = await source.getAddress();
  const expected = process.env.COM_WALLET_EXPECTED_ADDRESS?.trim();
  if (expected && sourceAddr.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`COM_WALLET key derives ${sourceAddr}, expected ${expected}`);
  }

  const recipients: Wallet[] = [];
  for (let i = 1; i <= N; i++) {
    recipients.push(walletFromEnv(`COM_WALLET_${i}_PRIVATE_KEY`));
  }
  const recipientAddrs = await Promise.all(recipients.map((w) => w.getAddress()));

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

  const splitEnv = process.env.SPLIT_HANSOME_AMOUNT?.trim();
  let totalHansome: bigint;
  if (splitEnv) {
    totalHansome = parseUnits(splitEnv, decimals);
    if (totalHansome > hansomeBal) {
      throw new Error(`SPLIT_HANSOME_AMOUNT > balance`);
    }
  } else {
    totalHansome = hansomeBal;
  }

  const per = totalHansome / BigInt(N);
  const dust = totalHansome - per * BigInt(N);

  console.log(`Split COM_WALLET → COM_WALLET_1..${N}`);
  console.log(`  Network: ${network.name} (${chainId})`);
  console.log(`  Source:  ${sourceAddr}`);
  console.log(`  Token:   ${symbol} ${hansomeAddress}`);
  console.log(`  Mode:    ${isDryRun ? "DRY_RUN" : "LIVE"}`);
  console.log(`  ETH gas: ${formatEther(ethBal)}`);
  console.log("");
  for (let i = 0; i < N; i++) {
    console.log(`  COM_${i + 1}: ${recipientAddrs[i]}`);
  }
  console.log("");
  console.log(`  Source balance: ${formatUnits(hansomeBal, decimals)}`);
  console.log(`  Total to split: ${formatUnits(totalHansome, decimals)}`);
  console.log(`  Per wallet:     ${formatUnits(per, decimals)}`);
  if (dust > 0n) console.log(`  Dust left:      ${formatUnits(dust, decimals)}`);

  if (per === 0n) throw new Error("Per-wallet amount is 0");
  if (ethBal === 0n) throw new Error("COM_WALLET has 0 ETH — fund gas before live split");

  if (isDryRun) {
    console.log("");
    console.log("DRY_RUN — no transfers sent.");
    return;
  }

  for (let i = 0; i < N; i++) {
    const to = recipientAddrs[i]!;
    console.log(`Transfer → COM_${i + 1}...`);
    const tx = await hansome.transfer(to, per);
    await tx.wait();
    console.log(`  ${tx.hash}`);
  }
  console.log("");
  console.log("Split complete.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
