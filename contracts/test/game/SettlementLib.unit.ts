import { expect } from "chai";
import { ethers } from "hardhat";
import { SettlementLibHarness } from "../../typechain-types";

const Side = { None: 0, Alpaca: 1, Cougar: 2 };
const Class = {
  None: 0,
  Common: 1,
  Guardian: 2,
  Farmer: 3,
  Lucky: 4,
  Runner: 5,
  King: 6,
};

describe("SettlementLib unit (GDS)", () => {
  let lib: SettlementLibHarness;

  before(async () => {
    lib = (await (
      await ethers.getContractFactory("SettlementLibHarness")
    ).deploy()) as SettlementLibHarness;
    await lib.waitForDeployment();
  });

  describe("U-LOC location weights & legality", () => {
    it("U-LOC-01 weights Home…River = 1,2,3,5,8", async () => {
      expect(await lib.locationWeight(0)).to.equal(1);
      expect(await lib.locationWeight(1)).to.equal(2);
      expect(await lib.locationWeight(2)).to.equal(3);
      expect(await lib.locationWeight(3)).to.equal(5);
      expect(await lib.locationWeight(4)).to.equal(8);
    });

    it("U-LOC-02/03/04 alpaca all legal; cougar not Home", async () => {
      for (let loc = 0; loc < 5; loc++) {
        expect(await lib.isLocationLegal(Side.Alpaca, loc)).to.equal(true);
      }
      expect(await lib.isLocationLegal(Side.Cougar, 0)).to.equal(false);
      for (let loc = 1; loc < 5; loc++) {
        expect(await lib.isLocationLegal(Side.Cougar, loc)).to.equal(true);
      }
    });
  });

  describe("U-POOL 80/10/10", () => {
    it("U-POOL-01 nominal split", async () => {
      const rd = ethers.parseEther("400000");
      const [ra, rc, rh, dust] = await lib.splitDailyPool(rd);
      expect(ra + rc + rh + dust).to.equal(rd);
      expect(ra).to.equal((rd * 80n) / 100n);
      expect(rc).to.equal((rd * 10n) / 100n);
      expect(rh).to.equal((rd * 10n) / 100n);
    });

    it("U-POOL-02 dust on non-divisible Rd", async () => {
      const rd = 1001n;
      const [ra, rc, rh, dust] = await lib.splitDailyPool(rd);
      expect(ra + rc + rh + dust).to.equal(rd);
      expect(dust).to.equal(rd - ra - rc - rh);
    });

    it("U-POOL-03 Rd=0", async () => {
      const [ra, rc, rh, dust] = await lib.splitDailyPool(0);
      expect(ra + rc + rh + dust).to.equal(0n);
    });
  });

  describe("U-TRAIT penalties", () => {
    it("U-TRAIT-01 pi0 table", async () => {
      expect(await lib.pi0Bps(0)).to.equal(0);
      expect(await lib.pi0Bps(1)).to.equal(1000);
      expect(await lib.pi0Bps(2)).to.equal(1500);
      expect(await lib.pi0Bps(3)).to.equal(2200);
      expect(await lib.pi0Bps(4)).to.equal(3000);
    });

    it("U-TRAIT-02 Home or Cd=0 → pre=0", async () => {
      expect(await lib.prePenaltyBps(0, 5, 2)).to.equal(0);
      expect(await lib.prePenaltyBps(4, 5, 0)).to.equal(0);
    });

    it("U-TRAIT-03 King → 0", async () => {
      expect(await lib.resolvePenaltyBps(4, 2, 1, Class.King, false, false)).to.equal(0);
    });

    it("U-TRAIT-04/05 Runner/Lucky success → 0", async () => {
      expect(await lib.resolvePenaltyBps(4, 2, 1, Class.Runner, true, false)).to.equal(0);
      expect(await lib.resolvePenaltyBps(4, 2, 1, Class.Lucky, false, true)).to.equal(0);
    });

    it("U-TRAIT-06 Guardian half pre", async () => {
      const pre = await lib.prePenaltyBps(4, 1, 1);
      const g = await lib.resolvePenaltyBps(4, 1, 1, Class.Guardian, false, false);
      expect(g).to.equal(pre / 2n);
    });

    it("U-TRAIT-07 Common = pre", async () => {
      const pre = await lib.prePenaltyBps(4, 1, 1);
      expect(await lib.resolvePenaltyBps(4, 1, 1, Class.Common, false, false)).to.equal(pre);
    });
  });

  describe("U-ALP / U-COG / INV settle", () => {
    it("U-ALP-01 single common takes all Ra gross/net (no cougars)", async () => {
      const rd = ethers.parseEther("1000");
      const alpacas = [
        {
          tokenId: 1n,
          locationId: 2,
          gameplayClass: Class.Common,
          runnerSuccess: false,
          luckySuccess: false,
        },
      ];
      const r = await lib.settle(rd, alpacas, []);
      const [ra] = await lib.splitDailyPool(rd);
      expect(r.alpacaNets[0]).to.equal(ra);
      expect(r.playerTotal + r.pen + r.unallocated).to.equal(rd);
    });

    it("U-ALP-04/E6 sole Farmer gets entire Ra", async () => {
      const rd = ethers.parseEther("1000");
      const alpacas = [
        {
          tokenId: 1n,
          locationId: 4,
          gameplayClass: Class.Farmer,
          runnerSuccess: false,
          luckySuccess: false,
        },
      ];
      const r = await lib.settle(rd, alpacas, []);
      const [ra] = await lib.splitDailyPool(rd);
      expect(r.alpacaNets[0]).to.equal(ra);
    });

    it("INV-02 Farmer+Common same loc: sum gross nets+pen = Ra", async () => {
      const rd = ethers.parseEther("10000");
      const alpacas = [
        {
          tokenId: 1n,
          locationId: 3,
          gameplayClass: Class.Farmer,
          runnerSuccess: false,
          luckySuccess: false,
        },
        {
          tokenId: 2n,
          locationId: 3,
          gameplayClass: Class.Common,
          runnerSuccess: false,
          luckySuccess: false,
        },
      ];
      const r = await lib.settle(rd, alpacas, []);
      const [ra, , , dust] = await lib.splitDailyPool(rd);
      // no cougars → Rc+Rh unallocated; alpaca nets+pen = Ra
      expect(r.alpacaNets[0] + r.alpacaNets[1] + r.pen).to.equal(ra);
      expect(r.playerTotal + r.pen + r.unallocated).to.equal(rd);
      expect(r.unallocated).to.equal(dust + (rd * 20n) / 100n);
      // Farmer share > Common
      expect(r.alpacaNets[0]).to.be.gt(r.alpacaNets[1]);
    });

    it("E1 no alpacas: Ra to unallocated; cougars get base", async () => {
      const rd = ethers.parseEther("1000");
      const cougars = [{ tokenId: 10n, locationId: 3 }];
      const r = await lib.settle(rd, [], cougars);
      const [, rc] = await lib.splitDailyPool(rd);
      expect(r.cougarTotals[0]).to.equal(rc); // hunt fails, Rh dust
      expect(r.huntDust).to.equal((rd * 10n) / 100n);
      expect(r.playerTotal + r.pen + r.unallocated).to.equal(rd);
    });

    it("E2 no cougars: Rc+Rh unallocated", async () => {
      const rd = ethers.parseEther("1000");
      const alpacas = [
        {
          tokenId: 1n,
          locationId: 0,
          gameplayClass: Class.Common,
          runnerSuccess: false,
          luckySuccess: false,
        },
      ];
      const r = await lib.settle(rd, alpacas, []);
      expect(r.unallocated).to.equal((rd * 20n) / 100n);
    });

    it("U-COG hunt success proportional; INV-01 conserve", async () => {
      const rd = ethers.parseEther("1000");
      const alpacas = [
        {
          tokenId: 1n,
          locationId: 3,
          gameplayClass: Class.Common,
          runnerSuccess: false,
          luckySuccess: false,
        },
        {
          tokenId: 2n,
          locationId: 3,
          gameplayClass: Class.Common,
          runnerSuccess: false,
          luckySuccess: false,
        },
      ];
      const cougars = [
        { tokenId: 10n, locationId: 3 },
        { tokenId: 11n, locationId: 1 }, // no alpaca → fail hunt
      ];
      const r = await lib.settle(rd, alpacas, cougars);
      expect(r.cougarTotals[0]).to.be.gt(r.cougarTotals[1]); // hunt + base vs base only
      expect(r.playerTotal + r.pen + r.unallocated).to.equal(rd);
    });

    it("E3 all hunts fail → Rh dust", async () => {
      const rd = ethers.parseEther("1000");
      const alpacas = [
        {
          tokenId: 1n,
          locationId: 0,
          gameplayClass: Class.Common,
          runnerSuccess: false,
          luckySuccess: false,
        },
      ];
      const cougars = [{ tokenId: 10n, locationId: 3 }];
      const r = await lib.settle(rd, alpacas, cougars);
      expect(r.huntDust).to.equal((rd * 10n) / 100n);
    });

    it("E7 King at River with cougars: pen=0 on king", async () => {
      const rd = ethers.parseEther("1000");
      const alpacas = [
        {
          tokenId: 1n,
          locationId: 4,
          gameplayClass: Class.King,
          runnerSuccess: false,
          luckySuccess: false,
        },
      ];
      const cougars = [{ tokenId: 10n, locationId: 4 }];
      const r = await lib.settle(rd, alpacas, cougars);
      expect(r.pen).to.equal(0);
      const [ra] = await lib.splitDailyPool(rd);
      expect(r.alpacaNets[0]).to.equal(ra);
    });
  });
});
