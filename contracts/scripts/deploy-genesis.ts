/**
 * Deploy HANSOME Genesis NFT with VRF-ready randomness provider.
 *
 * Env:
 *   ROYALTY_RECEIVER          — royalty fee recipient (default: deployer)
 *   PLACEHOLDER_URI           — pre-reveal URI
 *   USE_REVEAL_MOCK=1         — deploy RevealRandomnessMock (testnet/dev only)
 *   VRF_OPERATOR              — required if USE_REVEAL_MOCK is not set
 *   ADMIN_TIMELOCK_SECONDS    — non-zero shortens timelock (testnet); omit/0 = 24h
 *   SHORT_ADMIN_TIMELOCK=1    — force 60s timelock when ADMIN_TIMELOCK_SECONDS unset
 *   BOOTSTRAP_SALE=0          — skip commitment / reserve / open-public bootstrap
 *   GENESIS_MINT_PRICE_ETH    — mint price in ETH (default 0.001 on testnet bootstrap)
 *   RESERVE_MINT_TO           — reserved #001–#010 recipient (default: deployer)
 *   TESTNET_WL_SECONDS        — whitelist window length before public (default 600)
 *
 * Usage: npx hardhat run scripts/deploy-genesis.ts --network <network>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { ethers, network } from "hardhat";
import { buildSaleIdentities } from "./lib/genesis-identities";
import { getDeployerSigner } from "./lib/signer";

type GenesisDeploymentRecord = {
  network: string;
  chainId: number;
  contract: string;
  address: string;
  randomnessProvider: string;
  randomnessKind: "RevealRandomnessMock" | "VRFRevealAdapter";
  royaltyReceiver: string;
  placeholderURI: string;
  adminTimelockSeconds: number;
  saleIdentityCommitment: string;
  mintPriceWei: string;
  publicStart: number;
  whitelistStart: number;
  whitelistMerkleRoot: string;
  reservedTo: string;
  bootstrapped: boolean;
  testnetWhitelistOnly: boolean;
  deployTxHash: string;
  deployBlockNumber: number;
  deployedAt: string;
  deployer: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilTimestamp(target: number): Promise<void> {
  for (;;) {
    const block = await ethers.provider.getBlock("latest");
    const now = block?.timestamp ?? 0;
    if (now >= target) return;
    const remaining = target - now;
    console.log(`  Waiting for timelock… ${remaining}s remaining`);
    await sleep(Math.min(Math.max(remaining, 1) * 1000, 15_000));
  }
}

async function main() {
  const deployer = await getDeployerSigner(ethers.provider);
  const royaltyReceiver = process.env.ROYALTY_RECEIVER ?? deployer.address;
  const placeholderURI = process.env.PLACEHOLDER_URI ?? "ipfs://hansome-genesis/placeholder.json";
  const useMock =
    process.env.USE_REVEAL_MOCK === "1" || network.name === "robinhoodTestnet" || network.name === "hardhat";
  const bootstrap = process.env.BOOTSTRAP_SALE !== "0";
  const isTestnet = network.name === "robinhoodTestnet" || network.name === "hardhat";

  let adminTimelockSeconds = 0;
  if (process.env.ADMIN_TIMELOCK_SECONDS) {
    adminTimelockSeconds = Number(process.env.ADMIN_TIMELOCK_SECONDS);
  } else if (process.env.SHORT_ADMIN_TIMELOCK === "1" || isTestnet) {
    adminTimelockSeconds = 60;
  }

  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name);
  console.log("Admin timelock (sec):", adminTimelockSeconds === 0 ? 86400 : adminTimelockSeconds);

  let randomnessProvider: string;
  let randomnessKind: GenesisDeploymentRecord["randomnessKind"];

  if (useMock) {
    console.warn("WARNING: Deploying RevealRandomnessMock — NOT for mainnet.");
    const mockFactory = await ethers.getContractFactory("RevealRandomnessMock", deployer);
    const mock = await mockFactory.deploy(deployer.address);
    await mock.waitForDeployment();
    randomnessProvider = await mock.getAddress();
    randomnessKind = "RevealRandomnessMock";
    console.log("RevealRandomnessMock:", randomnessProvider);
  } else {
    const vrfOperator = process.env.VRF_OPERATOR;
    if (!vrfOperator) throw new Error("Set VRF_OPERATOR or USE_REVEAL_MOCK=1");
    const adapterFactory = await ethers.getContractFactory("VRFRevealAdapter", deployer);
    const adapter = await adapterFactory.deploy(deployer.address, vrfOperator);
    await adapter.waitForDeployment();
    randomnessProvider = await adapter.getAddress();
    randomnessKind = "VRFRevealAdapter";
    console.log("VRFRevealAdapter:", randomnessProvider);
  }

  const nftFactory = await ethers.getContractFactory("HansomeGenesisNFT", deployer);
  const nft = await nftFactory.deploy(
    deployer.address,
    royaltyReceiver,
    randomnessProvider,
    placeholderURI,
    adminTimelockSeconds,
  );
  const deployTx = nft.deploymentTransaction();
  if (!deployTx) throw new Error("Missing deployment transaction");
  const deployReceipt = await deployTx.wait();
  if (!deployReceipt) throw new Error("Missing deployment receipt");
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("HansomeGenesisNFT:", nftAddress);
  console.log("Deploy tx:", deployReceipt.hash);
  console.log("Deploy block:", deployReceipt.blockNumber);

  if (!useMock) {
    const adapter = await ethers.getContractAt("VRFRevealAdapter", randomnessProvider, deployer);
    await (await adapter.setConsumer(nftAddress)).wait();
    console.log("Adapter consumer set to NFT");
  }

  const identities = buildSaleIdentities();
  const commitment = ethers.keccak256(identities);
  let mintPriceWei = 0n;
  let publicStart = 0;
  let whitelistStart = 0;
  let whitelistMerkleRoot = ethers.ZeroHash;
  let reservedTo = process.env.RESERVE_MINT_TO ?? deployer.address;
  let bootstrapped = false;
  let testnetWhitelistOnly = false;

  if (bootstrap) {
    console.log("Bootstrapping sale…");
    await (await nft.setSaleIdentityCommitment(commitment)).wait();
    await (await nft.lockSaleIdentityCommitment()).wait();
    await (await nft.reserveMint(reservedTo)).wait();
    console.log("  Reserved #001–#010 →", reservedTo);

    const priceEth = process.env.GENESIS_MINT_PRICE_ETH ?? (isTestnet ? "0.001" : "0");
    mintPriceWei = ethers.parseEther(priceEth);

    const delay = adminTimelockSeconds === 0 ? 24 * 3600 : adminTimelockSeconds;
    const latest = await ethers.provider.getBlock("latest");
    const now = latest?.timestamp ?? Math.floor(Date.now() / 1000);

    // Testnet: short WL window so both whitelistMint and publicMint can be exercised.
    // Mainnet bootstrap path (if ever used with bootstrap): open public right after execute.
    const wlWindow = Number(process.env.TESTNET_WL_SECONDS ?? "600");
    if (isTestnet) {
      testnetWhitelistOnly = true;
      publicStart = now + delay + wlWindow;
      const wlAddresses = [deployer.address];
      const tree = StandardMerkleTree.of(
        wlAddresses.map((a) => [a]),
        ["address"],
      );
      whitelistMerkleRoot = tree.root;

      const proofs: Record<string, string[]> = {};
      for (const [i, v] of tree.entries()) {
        const addr = (v[0] as string).toLowerCase();
        proofs[ethers.getAddress(addr)] = tree.getProof(i);
        proofs[addr] = tree.getProof(i);
      }

      const wlOut = {
        warning: "TESTNET ONLY — do not reuse this merkle root or proofs on mainnet.",
        network: network.name,
        chainId: Number((await ethers.provider.getNetwork()).chainId),
        merkleRoot: whitelistMerkleRoot,
        addresses: wlAddresses,
        proofs,
        generatedAt: new Date().toISOString(),
      };

      const deploymentsDir = join(__dirname, "..", "deployments");
      mkdirSync(deploymentsDir, { recursive: true });
      writeFileSync(
        join(deploymentsDir, `${network.name}-genesis-whitelist-TESTNET-ONLY.json`),
        JSON.stringify(wlOut, null, 2),
      );

      // Frontend copy (explicitly testnet-scoped filename).
      const feDir = join(__dirname, "..", "..", "lib", "game", "testnet");
      mkdirSync(feDir, { recursive: true });
      writeFileSync(join(feDir, "whitelistProofs.TESTNET-ONLY.json"), JSON.stringify(wlOut, null, 2));

      console.log("  TESTNET merkle root:", whitelistMerkleRoot);
      console.log("  WL addresses:", wlAddresses.join(", "));
      console.log("  WL window (sec):", wlWindow);
    } else {
      publicStart = now + delay + 5;
    }

    whitelistStart = publicStart > 3600 ? publicStart - 3600 : 0;

    await (await nft.scheduleMintPrice(mintPriceWei)).wait();
    await (await nft.schedulePublicStart(publicStart)).wait();
    if (testnetWhitelistOnly) {
      await (await nft.scheduleWhitelistMerkleRoot(whitelistMerkleRoot)).wait();
    }
    console.log("  Scheduled mintPrice:", ethers.formatEther(mintPriceWei), "ETH");
    console.log("  Scheduled publicStart:", publicStart);
    console.log("  Expected whitelistStart:", whitelistStart);

    // Extra buffer: RPC timestamp can lag a few seconds past local eta.
    await waitUntilTimestamp(now + delay + 5);
    await (await nft.executeMintPrice(mintPriceWei)).wait();
    if (testnetWhitelistOnly) {
      await (await nft.executeWhitelistMerkleRoot(whitelistMerkleRoot)).wait();
    }
    await (await nft.executePublicStart(publicStart)).wait();

    const openWl = await nft.isWhitelistOpen();
    const openPub = await nft.isPublicOpen();
    console.log("  isWhitelistOpen:", openWl);
    console.log("  isPublicOpen:", openPub);
    bootstrapped = true;
  } else {
    await (await nft.setSaleIdentityCommitment(commitment)).wait();
    console.log("  Sale identity commitment set (not locked; BOOTSTRAP_SALE=0)");
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const record: GenesisDeploymentRecord = {
    network: network.name,
    chainId,
    contract: "HansomeGenesisNFT",
    address: nftAddress,
    randomnessProvider,
    randomnessKind,
    royaltyReceiver,
    placeholderURI,
    adminTimelockSeconds: adminTimelockSeconds === 0 ? 86400 : adminTimelockSeconds,
    saleIdentityCommitment: commitment,
    mintPriceWei: mintPriceWei.toString(),
    publicStart,
    whitelistStart,
    whitelistMerkleRoot,
    reservedTo,
    bootstrapped,
    testnetWhitelistOnly,
    deployTxHash: deployReceipt.hash,
    deployBlockNumber: deployReceipt.blockNumber,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  const deploymentsDir = join(__dirname, "..", "deployments");
  mkdirSync(deploymentsDir, { recursive: true });
  const outPath = join(deploymentsDir, `${network.name}-genesis.json`);
  writeFileSync(outPath, JSON.stringify(record, null, 2));

  writeFileSync(
    join(deploymentsDir, `${network.name}-genesis-identities.bin`),
    Buffer.from(identities),
  );

  const reportPath = join(deploymentsDir, `${network.name}-genesis-report.md`);
  writeFileSync(
    reportPath,
    [
      `# Genesis deploy report — ${network.name}`,
      "",
      `- Contract: \`${nftAddress}\``,
      `- Chain ID: ${chainId}`,
      `- Deploy tx: \`${deployReceipt.hash}\``,
      `- Deploy block: ${deployReceipt.blockNumber}`,
      `- Deployer: \`${deployer.address}\``,
      `- Placeholder URI: \`${placeholderURI}\``,
      `- Mint price: ${ethers.formatEther(mintPriceWei)} ETH`,
      `- publicStart: ${publicStart}`,
      `- whitelistStart: ${whitelistStart}`,
      `- merkleRoot: \`${whitelistMerkleRoot}\``,
      `- testnetWhitelistOnly: ${testnetWhitelistOnly}`,
      `- randomness: ${randomnessKind} @ \`${randomnessProvider}\``,
      `- Deployed at: ${record.deployedAt}`,
      "",
      testnetWhitelistOnly
        ? "WARNING: Merkle root/proofs are TESTNET ONLY. Do not reuse on mainnet."
        : "",
      "",
    ].join("\n"),
  );

  console.log("Saved:", outPath);
  console.log("Report:", reportPath);
  console.log(JSON.stringify(record, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
