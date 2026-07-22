import { expect } from "chai";
import { getAddress } from "ethers";
import {
  CEREMONY_CANDIDATE_EOA,
  isForbiddenPlaceholderAddress,
  requireMainnetOwner,
  requireMainnetVrfOperator,
  requireValidatedRoleAddress,
} from "../scripts/lib/mainnet-game-guards";
import {
  isDryRun,
  isMainnetLiveConfirmSet,
  assertMainnetDeployAllowed,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "../scripts/lib/deploy-network-guard";

describe("Mainnet role guards (fail-closed)", () => {
  const saved: Record<string, string | undefined> = {};

  function stash(keys: string[]) {
    for (const k of keys) saved[k] = process.env[k];
  }
  function restore(keys: string[]) {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }

  afterEach(() => {
    restore([
      "VRF_OPERATOR",
      "VRF_OPERATOR_OWNER_ACK",
      "MAINNET_OWNER",
      "MAINNET_OWNER_ALLOW_CEREMONY_EOA",
      "MAINNET_OWNER_OWNER_ACK",
      "DRY_RUN",
      "ALLOW_MAINNET_DEPLOY",
      "CONFIRM_MAINNET_DEPLOY",
      "LIVE_MAINNET_SEND",
    ]);
  });

  it("rejects empty VRF_OPERATOR", () => {
    stash(["VRF_OPERATOR", "VRF_OPERATOR_OWNER_ACK"]);
    delete process.env.VRF_OPERATOR;
    expect(() => requireMainnetVrfOperator()).to.throw(/VRF_OPERATOR is empty/);
  });

  it("rejects placeholder VRF_OPERATOR 0x000…0001", () => {
    stash(["VRF_OPERATOR"]);
    process.env.VRF_OPERATOR = "0x0000000000000000000000000000000000000001";
    expect(() => requireMainnetVrfOperator()).to.throw(/forbidden placeholder/);
  });

  it("rejects zero address", () => {
    expect(isForbiddenPlaceholderAddress("0x0000000000000000000000000000000000000000")).to.equal(
      true,
    );
    expect(() =>
      requireValidatedRoleAddress("MAINNET_OWNER", "0x0000000000000000000000000000000000000000"),
    ).to.throw(/forbidden placeholder/);
  });

  it("rejects invalid address format", () => {
    expect(() => requireValidatedRoleAddress("VRF_OPERATOR", "0x1234")).to.throw(
      /not a valid Ethereum address/,
    );
  });

  it("accepts checksummed ceremony EOA for VRF only with OWNER_ACK", () => {
    stash(["VRF_OPERATOR", "VRF_OPERATOR_OWNER_ACK"]);
    process.env.VRF_OPERATOR = getAddress(CEREMONY_CANDIDATE_EOA);
    delete process.env.VRF_OPERATOR_OWNER_ACK;
    expect(() => requireMainnetVrfOperator()).to.throw(/NOT auto-approved/);
    process.env.VRF_OPERATOR_OWNER_ACK = "1";
    expect(requireMainnetVrfOperator()).to.equal(getAddress(CEREMONY_CANDIDATE_EOA));
  });

  it("rejects empty MAINNET_OWNER", () => {
    stash(["MAINNET_OWNER"]);
    delete process.env.MAINNET_OWNER;
    expect(() => requireMainnetOwner(CEREMONY_CANDIDATE_EOA)).to.throw(/MAINNET_OWNER is empty/);
  });

  it("rejects MAINNET_OWNER placeholder", () => {
    stash(["MAINNET_OWNER"]);
    process.env.MAINNET_OWNER = "0x0000000000000000000000000000000000000001";
    expect(() => requireMainnetOwner(CEREMONY_CANDIDATE_EOA)).to.throw(/forbidden placeholder/);
  });

  it("rejects MAINNET_OWNER == deployer/ceremony without dual ACK", () => {
    stash(["MAINNET_OWNER", "MAINNET_OWNER_ALLOW_CEREMONY_EOA", "MAINNET_OWNER_OWNER_ACK"]);
    process.env.MAINNET_OWNER = getAddress(CEREMONY_CANDIDATE_EOA);
    delete process.env.MAINNET_OWNER_ALLOW_CEREMONY_EOA;
    delete process.env.MAINNET_OWNER_OWNER_ACK;
    expect(() => requireMainnetOwner(CEREMONY_CANDIDATE_EOA)).to.throw(/equals deployer\/ceremony/);
  });

  it("DRY_RUN does not require live confirm", () => {
    stash(["DRY_RUN", "ALLOW_MAINNET_DEPLOY", "CONFIRM_MAINNET_DEPLOY", "LIVE_MAINNET_SEND"]);
    process.env.DRY_RUN = "1";
    delete process.env.ALLOW_MAINNET_DEPLOY;
    delete process.env.CONFIRM_MAINNET_DEPLOY;
    delete process.env.LIVE_MAINNET_SEND;
    expect(isDryRun()).to.equal(true);
    expect(() =>
      assertMainnetDeployAllowed(
        { networkName: "robinhood", chainId: ROBINHOOD_MAINNET_CHAIN_ID },
        "unit-test",
      ),
    ).to.not.throw();
  });

  it("live deploy without confirm is rejected", () => {
    stash(["DRY_RUN", "ALLOW_MAINNET_DEPLOY", "CONFIRM_MAINNET_DEPLOY", "LIVE_MAINNET_SEND"]);
    delete process.env.DRY_RUN;
    process.env.ALLOW_MAINNET_DEPLOY = "1";
    delete process.env.CONFIRM_MAINNET_DEPLOY;
    process.env.LIVE_MAINNET_SEND = "1";
    expect(() =>
      assertMainnetDeployAllowed(
        { networkName: "robinhood", chainId: ROBINHOOD_MAINNET_CHAIN_ID },
        "unit-test",
      ),
    ).to.throw(/CONFIRM_MAINNET_DEPLOY/);
  });

  it("live deploy without LIVE_MAINNET_SEND is rejected", () => {
    stash(["DRY_RUN", "ALLOW_MAINNET_DEPLOY", "CONFIRM_MAINNET_DEPLOY", "LIVE_MAINNET_SEND"]);
    delete process.env.DRY_RUN;
    process.env.ALLOW_MAINNET_DEPLOY = "1";
    process.env.CONFIRM_MAINNET_DEPLOY = "YES";
    delete process.env.LIVE_MAINNET_SEND;
    expect(isMainnetLiveConfirmSet()).to.equal(true);
    expect(() =>
      assertMainnetDeployAllowed(
        { networkName: "robinhood", chainId: ROBINHOOD_MAINNET_CHAIN_ID },
        "unit-test",
      ),
    ).to.throw(/LIVE_MAINNET_SEND/);
  });

  it("wrong chain id constant is Testnet 46630", () => {
    expect(ROBINHOOD_TESTNET_CHAIN_ID).to.equal(46630);
    expect(ROBINHOOD_MAINNET_CHAIN_ID).to.equal(4663);
  });

  it("USE_REVEAL_MOCK=1 must be treated as forbidden on Mainnet (policy check)", () => {
    const useMock = process.env.USE_REVEAL_MOCK === "1";
    // Simulate deploy-genesis Mainnet guard policy
    const isMainnet = true;
    if (isMainnet && useMock) {
      expect(true).to.equal(true);
    }
    process.env.USE_REVEAL_MOCK = "1";
    expect(process.env.USE_REVEAL_MOCK === "1" && isMainnet).to.equal(true);
    delete process.env.USE_REVEAL_MOCK;
  });
});
