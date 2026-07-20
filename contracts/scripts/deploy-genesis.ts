/**
 * Deploy HANSOME Genesis NFT with VRF-ready randomness provider.
 *
 * Env:
 *   ROYALTY_RECEIVER          — royalty fee recipient (default: deployer)
 *   PLACEHOLDER_URI           — pre-reveal URI
 *   USE_REVEAL_MOCK=1         — deploy RevealRandomnessMock (testnet/dev only; FORBIDDEN on Mainnet)
 *   VRF_OPERATOR              — required if USE_REVEAL_MOCK is not set
 *   ADMIN_TIMELOCK_SECONDS    — non-zero shortens timelock (testnet); omit/0 = 24h
 *   SHORT_ADMIN_TIMELOCK=1    — force 60s timelock when ADMIN_TIMELOCK_SECONDS unset
 *   BOOTSTRAP_SALE=0          — Mainnet: skip sale price/start/merkle bootstrap;
 *                               still runs commitment lock + reserveMint (required)
 *   GENESIS_MINT_PRICE_ETH    — mint price in ETH (default 0.001 on testnet bootstrap)
 *   RESERVE_MINT_TO           — founder wallet receiving #001–#010 (REQUIRED on Mainnet)
 *   TESTNET_WL_SECONDS        — whitelist window length before public (default 600)
 *   DRY_RUN=1                 — validate + log plan; write *.dry-run.json; no txs
 *   ALLOW_MAINNET_DEPLOY=1    — required for --network mainnet|robinhood (with CONFIRM unless DRY_RUN)
 *   CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND — required for live Mainnet writes
 *
 * Usage:
 *   npx hardhat run scripts/deploy-genesis.ts --network robinhoodTestnet
 *   DRY_RUN=1 npx hardhat run scripts/deploy-genesis.ts --network mainnet
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { ethers, network } from "hardhat";
import { buildSaleIdentities } from "./lib/genesis-identities";
import {
  assertChainIdMatchesNetwork,
  assertKnownNetwork,
  assertMainnetDeployAllowed,
  deploymentFileStem,
  explorerBase,
  isDryRun,
  isMainnetNetwork,
  logDeployBanner,
  logLiveMainnetPreflight,
} from "./lib/deploy-network-guard";
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
  saleIdentityCommitmentLocked?: boolean;
  mintPriceWei: string;
  publicStart: number;
  whitelistStart: number;
  whitelistMerkleRoot: string;
  /** Planned / actual recipient of reserveMint(#001–#010). */
  reservedTo: string;
  reservedMinted?: boolean;
  reservedMintTxHash?: string;
  /** pending | complete | failed — for recovery after partial deploy */
  reserveMintStatus?: "pending" | "complete" | "failed";
  reserveMintError?: string;
  bootstrapped: boolean;
  testnetWhitelistOnly: boolean;
  deployTxHash: string;
  deployBlockNumber: number;
  deployedAt: string;
  deployer: string;
};

function writeGenesisRecord(
  fileStem: string,
  record: GenesisDeploymentRecord,
): string {
  const deploymentsDir = join(__dirname, "..", "deployments");
  mkdirSync(deploymentsDir, { recursive: true });
  const outPath = join(deploymentsDir, `${fileStem}-genesis.json`);
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
  return outPath;
}

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
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const ctx = { networkName: network.name, chainId };
  assertKnownNetwork(ctx.networkName);
  assertChainIdMatchesNetwork(ctx);
  if (isMainnetNetwork(ctx)) {
    assertMainnetDeployAllowed(ctx, "deploy-genesis.ts");
  }

  const deployer = await getDeployerSigner(ethers.provider);
  const royaltyReceiver = process.env.ROYALTY_RECEIVER ?? deployer.address;
  const placeholderURI = process.env.PLACEHOLDER_URI ?? "ipfs://hansome-genesis/placeholder.json";
  const useMock =
    process.env.USE_REVEAL_MOCK === "1" ||
    (!isMainnetNetwork(ctx) &&
      (network.name === "robinhoodTestnet" || network.name === "hardhat"));
  const bootstrap = process.env.BOOTSTRAP_SALE !== "0";
  const isTestnet = network.name === "robinhoodTestnet" || network.name === "hardhat";

  if (isMainnetNetwork(ctx) && useMock) {
    throw new Error(
      "REFUSED: RevealRandomnessMock is forbidden on Mainnet. Unset USE_REVEAL_MOCK and set VRF_OPERATOR.",
    );
  }

  let adminTimelockSeconds = 0;
  if (process.env.ADMIN_TIMELOCK_SECONDS) {
    adminTimelockSeconds = Number(process.env.ADMIN_TIMELOCK_SECONDS);
  } else if (process.env.SHORT_ADMIN_TIMELOCK === "1" || isTestnet) {
    adminTimelockSeconds = 60;
  }

  const fileStem = deploymentFileStem(ctx);
  const vrfOperatorEnv = process.env.VRF_OPERATOR?.trim() || "";

  logDeployBanner("deploy-genesis.ts", ctx, {
    DEPLOYER: deployer.address,
    ROYALTY_RECEIVER: royaltyReceiver,
    USE_MOCK: useMock,
    VRF_OPERATOR: vrfOperatorEnv || "(none)",
    ADMIN_TIMELOCK_SEC: adminTimelockSeconds === 0 ? 86400 : adminTimelockSeconds,
    BOOTSTRAP_SALE: bootstrap,
    EXPLORER: explorerBase(ctx),
  });

  const reserveMintToEnv = process.env.RESERVE_MINT_TO?.trim() || "";
  if (isMainnetNetwork(ctx) && !bootstrap && !reserveMintToEnv && !isDryRun()) {
    throw new Error(
      "REFUSED: Mainnet Genesis live deploy requires RESERVE_MINT_TO (founderWallet for reserveMint #001–#010).",
    );
  }

  if (isDryRun()) {
    if (isMainnetNetwork(ctx) && !useMock && !vrfOperatorEnv) {
      throw new Error(
        "REFUSED: Mainnet Genesis dry-run requires VRF_OPERATOR (RevealRandomnessMock forbidden).",
      );
    }
    if (isMainnetNetwork(ctx) && !reserveMintToEnv) {
      throw new Error(
        "REFUSED: Mainnet Genesis dry-run requires RESERVE_MINT_TO (founderWallet).",
      );
    }
    if (isMainnetNetwork(ctx) && adminTimelockSeconds !== 0 && adminTimelockSeconds < 3600) {
      console.warn(
        `WARNING: Mainnet adminTimelockSeconds=${adminTimelockSeconds} is short; prefer 0 (24h) or >= 3600.`,
      );
    }
    const plan = {
      mode: "DRY_RUN",
      script: "deploy-genesis.ts",
      network: ctx.networkName,
      chainId: ctx.chainId,
      deploymentFileStem: fileStem,
      deployer: deployer.address,
      royaltyReceiver,
      placeholderURI,
      useMock,
      randomnessKind: useMock ? "RevealRandomnessMock" : "VRFRevealAdapter",
      vrfOperator: vrfOperatorEnv || null,
      adminTimelockSeconds: adminTimelockSeconds === 0 ? 86400 : adminTimelockSeconds,
      bootstrap,
      reserveMintTo: reserveMintToEnv || null,
      postDeployOrder: isMainnetNetwork(ctx)
        ? [
            "1) Deploy VRFRevealAdapter + HansomeGenesisNFT",
            "2) setConsumer(genesis)",
            "3) setSaleIdentityCommitment + lockSaleIdentityCommitment",
            "4) reserveMint(founderWallet) → #001–#010 FIRST mint action",
            "5) verify-mainnet-reserved.ts (ownerOf 1..10)",
            "6) Continue Game suite deploy (deploy-game.ts)",
          ]
        : ["deploy + optional BOOTSTRAP_SALE"],
      reservedAllocationPurpose: {
        "001": "Founder NFT",
        "002-004": "Internal Mainnet gameplay testing",
        "005-010": "Community giveaways, partnerships, collaborations",
      },
      constructors: {
        VRFRevealAdapter: ["initialOwner=deployer", `vrfOperator=${vrfOperatorEnv || "?"}`],
        HansomeGenesisNFT: [
          "initialOwner=deployer",
          `royaltyReceiver=${royaltyReceiver}`,
          "randomnessProvider=VRFRevealAdapter",
          `placeholderURI=${placeholderURI}`,
          `adminTimelockSeconds=${adminTimelockSeconds === 0 ? 86400 : adminTimelockSeconds}`,
        ],
      },
      generatedAt: new Date().toISOString(),
    };
    const deploymentsDir = join(__dirname, "..", "deployments");
    mkdirSync(deploymentsDir, { recursive: true });
    const outPath = join(deploymentsDir, `${fileStem}-genesis.dry-run.json`);
    writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`);
    console.log("DRY_RUN complete — no transactions sent.");
    console.log("Wrote", outPath);
    return;
  }

  if (isMainnetNetwork(ctx)) {
    if (!vrfOperatorEnv) {
      throw new Error("REFUSED: Mainnet requires explicit VRF_OPERATOR.");
    }
    logLiveMainnetPreflight("deploy-genesis.ts", ctx, {
      deployer: deployer.address,
      royaltyReceiver,
      vrfOperator: vrfOperatorEnv,
      placeholderURI,
      adminTimelockSeconds:
        adminTimelockSeconds === 0 ? 86400 : adminTimelockSeconds,
      bootstrap,
      useMock: false,
      reserveMintTo: reserveMintToEnv,
      firstMintAction: "reserveMint(founderWallet) → #001–#010",
      outputJson: `deployments/${fileStem}-genesis.json`,
    });
  }

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
    if (!vrfOperatorEnv) throw new Error("Set VRF_OPERATOR or USE_REVEAL_MOCK=1");
    console.log("CHAIN_ID before tx:", ctx.chainId);
    console.log("Deploying VRFRevealAdapter with operator:", vrfOperatorEnv);
    const adapterFactory = await ethers.getContractFactory("VRFRevealAdapter", deployer);
    const adapter = await adapterFactory.deploy(deployer.address, vrfOperatorEnv);
    await adapter.waitForDeployment();
    randomnessProvider = await adapter.getAddress();
    randomnessKind = "VRFRevealAdapter";
    console.log("VRFRevealAdapter:", randomnessProvider);
  }

  console.log("CHAIN_ID before tx:", ctx.chainId);
  console.log("Deploying HansomeGenesisNFT with randomnessProvider:", randomnessProvider);
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
  let reservedMintedFlag = false;
  let reservedMintTxHash = "";
  let reserveMintStatus: GenesisDeploymentRecord["reserveMintStatus"] = "pending";
  let reserveMintError: string | undefined;
  let commitmentLockedFlag = false;

  // Persist address immediately so reserveMint failure is recoverable via JSON.
  const earlyRecord: GenesisDeploymentRecord = {
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
    saleIdentityCommitmentLocked: false,
    mintPriceWei: "0",
    publicStart: 0,
    whitelistStart: 0,
    whitelistMerkleRoot: ethers.ZeroHash,
    reservedTo,
    reservedMinted: false,
    reserveMintStatus: "pending",
    bootstrapped: false,
    testnetWhitelistOnly: false,
    deployTxHash: deployReceipt.hash,
    deployBlockNumber: deployReceipt.blockNumber,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };
  const earlyPath = writeGenesisRecord(fileStem, earlyRecord);
  console.log("Wrote early deployment JSON (recoverable if reserveMint fails):", earlyPath);

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
  } else if (isMainnetNetwork(ctx)) {
    // Mainnet ceremony (BOOTSTRAP_SALE=0): lock commitment, then reserveMint FIRST.
    // Sale price / publicStart / merkle are scheduled later via schedule-mainnet-mint-sale.ts.
    const founder = ethers.getAddress(reserveMintToEnv);
    reservedTo = founder;
    console.log("Mainnet post-deploy: preparing reserved allocation…");
    console.log("  founderWallet (RESERVE_MINT_TO):", founder);
    console.log("  Purpose:");
    console.log("    #001       Founder NFT");
    console.log("    #002–#004  Internal Mainnet gameplay testing");
    console.log("    #005–#010  Community giveaways / partnerships / collaborations");
    try {
      const alreadyReserved = Boolean(await nft.reservedMinted());
      if (alreadyReserved) {
        reservedMintedFlag = true;
        reserveMintStatus = "complete";
        commitmentLockedFlag = Boolean(await nft.saleIdentityCommitmentLocked());
        console.log("  reservedMinted already true — skipping reserveMint (idempotent)");
      } else {
        if (!(await nft.saleIdentityCommitmentLocked())) {
          if ((await nft.saleIdentityCommitment()) === ethers.ZeroHash) {
            await (await nft.setSaleIdentityCommitment(commitment)).wait();
          }
          await (await nft.lockSaleIdentityCommitment()).wait();
          console.log("  Sale identity commitment set + locked");
        } else {
          console.log("  Sale identity commitment already locked");
        }
        commitmentLockedFlag = true;
        console.log("CHAIN_ID before reserveMint:", ctx.chainId);
        console.log("Calling reserveMint(", founder, ") — first mint action after deploy");
        const reserveTx = await nft.reserveMint(founder);
        const reserveReceipt = await reserveTx.wait();
        reservedMintTxHash = reserveReceipt?.hash ?? "";
        reservedMintedFlag = Boolean(await nft.reservedMinted());
        reserveMintStatus = "complete";
        console.log("  Reserved #001–#010 →", founder);
        console.log("  reservedMinted:", reservedMintedFlag);
        console.log("  reserveMint tx:", reservedMintTxHash);
        console.log("  totalMinted:", (await nft.totalMinted()).toString());
      }
      console.log("  Next: npx hardhat run scripts/verify-mainnet-reserved.ts --network mainnet");
      console.log("  Then: continue Game suite deploy (deploy-game.ts)");
    } catch (e) {
      reserveMintStatus = "failed";
      reserveMintError = e instanceof Error ? e.message : String(e);
      writeGenesisRecord(fileStem, {
        ...earlyRecord,
        reservedTo: founder,
        saleIdentityCommitment: commitment,
        saleIdentityCommitmentLocked: Boolean(
          await nft.saleIdentityCommitmentLocked().catch(() => false),
        ),
        reservedMinted: Boolean(await nft.reservedMinted().catch(() => false)),
        reserveMintStatus: "failed",
        reserveMintError,
      });
      console.error("REFUSED/FAILED: reserveMint did not complete.");
      console.error("  Genesis is deployed at:", nftAddress);
      console.error("  Early JSON updated with reserveMintStatus=failed.");
      console.error("  Recovery (do NOT redeploy Genesis):");
      console.error(
        `    GENESIS_NFT_ADDRESS=${nftAddress} RESERVE_MINT_TO=${founder} \\`,
      );
      console.error(
        "    ALLOW_MAINNET_DEPLOY=1 CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND \\",
      );
      console.error(
        "    npx hardhat run scripts/reserve-mint-mainnet.ts --network mainnet",
      );
      console.error("  See docs/MAINNET_GENESIS_MINT_OPS.md § Recovery");
      throw e;
    }
  } else {
    await (await nft.setSaleIdentityCommitment(commitment)).wait();
    console.log("  Sale identity commitment set (not locked; BOOTSTRAP_SALE=0)");
  }

  // Bootstrap path also calls reserveMint — reflect on-chain state when possible.
  if (bootstrap) {
    reservedMintedFlag = Boolean(await nft.reservedMinted());
    commitmentLockedFlag = Boolean(await nft.saleIdentityCommitmentLocked());
    reserveMintStatus = reservedMintedFlag ? "complete" : "pending";
  }

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
    saleIdentityCommitmentLocked: commitmentLockedFlag,
    mintPriceWei: mintPriceWei.toString(),
    publicStart,
    whitelistStart,
    whitelistMerkleRoot,
    reservedTo,
    reservedMinted: reservedMintedFlag,
    reservedMintTxHash: reservedMintTxHash || undefined,
    reserveMintStatus,
    reserveMintError,
    bootstrapped,
    testnetWhitelistOnly,
    deployTxHash: deployReceipt.hash,
    deployBlockNumber: deployReceipt.blockNumber,
    deployedAt: earlyRecord.deployedAt,
    deployer: deployer.address,
  };

  const outPath = writeGenesisRecord(fileStem, record);
  console.log("Wrote", outPath);
  console.log("Saved Genesis address:", nftAddress);
  console.log("Saved reservedTo:", reservedTo, "reservedMinted:", reservedMintedFlag);

  const deploymentsDir = join(__dirname, "..", "deployments");
  mkdirSync(deploymentsDir, { recursive: true });
  writeFileSync(
    join(deploymentsDir, `${fileStem}-genesis-identities.bin`),
    Buffer.from(identities),
  );

  const reportPath = join(deploymentsDir, `${fileStem}-genesis-report.md`);
  writeFileSync(
    reportPath,
    [
      `# Genesis deploy report — ${network.name} (stem=${fileStem})`,
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
      `- reservedTo: \`${reservedTo}\``,
      `- reservedMinted: \`${reservedMintedFlag}\``,
      `- reserveMintStatus: \`${reserveMintStatus}\``,
      `- Deployed at: ${record.deployedAt}`,
      "",
      isMainnetNetwork(ctx)
        ? [
            "## Reserved allocation (Mainnet)",
            "",
            "- `#001` Founder NFT",
            "- `#002`–`#004` Internal Mainnet gameplay testing",
            "- `#005`–`#010` Community giveaways, partnerships, collaborations",
            "",
            "Verify:",
            "```bash",
            "npx hardhat run scripts/verify-mainnet-reserved.ts --network mainnet",
            "```",
            "",
            "Then continue Game deploy with GENESIS_NFT_ADDRESS from this report.",
            "",
          ].join("\n")
        : "",
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
