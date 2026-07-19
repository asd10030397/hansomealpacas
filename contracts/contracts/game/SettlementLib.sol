// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HansomeTypes} from "../genesis/HansomeTypes.sol";
import {GameTypes} from "./GameTypes.sol";

/**
 * @title SettlementLib
 * @notice Pure GDS v1.1 settlement math (§9–§12). No storage. No new mechanics.
 */
library SettlementLib {
    error InvalidLocation();
    error ConservationFailed();

    struct AlpacaInput {
        uint256 tokenId;
        uint8 locationId;
        HansomeTypes.GameplayClass gameplayClass;
        bool runnerSuccess;
        bool luckySuccess;
    }

    struct CougarInput {
        uint256 tokenId;
        uint8 locationId;
    }

    struct SettlementResult {
        uint256[] alpacaTokenIds;
        uint256[] alpacaNets;
        uint256[] cougarTokenIds;
        uint256[] cougarTotals;
        uint256 pen;
        uint256 huntDust; // Rh when all hunts fail (also included in unallocated)
        uint256 unallocated; // split dust + empty pools + failed hunt Rh
        uint256 playerTotal;
    }

    function locationWeight(uint8 locationId) internal pure returns (uint256) {
        if (locationId == GameTypes.LOC_HOME) return 1;
        if (locationId == GameTypes.LOC_MOUNTAIN) return 2;
        if (locationId == GameTypes.LOC_GRASSLAND) return 3;
        if (locationId == GameTypes.LOC_FOREST) return 5;
        if (locationId == GameTypes.LOC_RIVER) return 8;
        revert InvalidLocation();
    }

    /// @dev Candidate A ladder (bps): Home 0 / Mountain 15% / Grassland 25% / Forest 35% / River 45%.
    function pi0Bps(uint8 locationId) internal pure returns (uint256) {
        if (locationId == GameTypes.LOC_HOME) return 0;
        if (locationId == GameTypes.LOC_MOUNTAIN) return 1_500;
        if (locationId == GameTypes.LOC_GRASSLAND) return 2_500;
        if (locationId == GameTypes.LOC_FOREST) return 3_500;
        if (locationId == GameTypes.LOC_RIVER) return 4_500;
        revert InvalidLocation();
    }

    function isLocationLegal(HansomeTypes.Side side, uint8 locationId) internal pure returns (bool) {
        if (locationId >= GameTypes.LOC_COUNT) return false;
        if (side == HansomeTypes.Side.Alpaca) return true;
        if (side == HansomeTypes.Side.Cougar) return locationId != GameTypes.LOC_HOME;
        return false;
    }

    function isHuntable(uint8 locationId) internal pure returns (bool) {
        return locationId >= GameTypes.LOC_MOUNTAIN && locationId <= GameTypes.LOC_RIVER;
    }

    function splitDailyPool(uint256 rd)
        internal
        pure
        returns (uint256 ra, uint256 rc, uint256 rh, uint256 dust)
    {
        ra = (rd * 80) / 100;
        rc = (rd * 10) / 100;
        rh = (rd * 10) / 100;
        dust = rd - ra - rc - rh;
    }

    /// @dev Numerator scale: non-farmer w*100, farmer w*120 (I-FARMER-NORM).
    function weightNumerator(uint8 locationId, HansomeTypes.GameplayClass gameplayClass)
        internal
        pure
        returns (uint256)
    {
        uint256 w = locationWeight(locationId);
        if (gameplayClass == HansomeTypes.GameplayClass.Farmer) {
            return w * GameTypes.FARMER_NUM;
        }
        return w * GameTypes.FARMER_DEN;
    }

    function prePenaltyBps(uint8 locationId, uint256 adL, uint256 cdL) internal pure returns (uint256) {
        if (locationId == GameTypes.LOC_HOME || cdL == 0) return 0;
        uint256 pi0 = pi0Bps(locationId);
        uint256 scaled = (pi0 * (adL + cdL)) / (adL + 1);
        if (scaled > GameTypes.MAX_PRE_PENALTY_BPS) return GameTypes.MAX_PRE_PENALTY_BPS;
        return scaled;
    }

    function resolvePenaltyBps(
        uint8 locationId,
        uint256 adL,
        uint256 cdL,
        HansomeTypes.GameplayClass gameplayClass,
        bool runnerSuccess,
        bool luckySuccess
    ) internal pure returns (uint256) {
        if (gameplayClass == HansomeTypes.GameplayClass.King) return 0;

        uint256 pre = prePenaltyBps(locationId, adL, cdL);

        if (gameplayClass == HansomeTypes.GameplayClass.Runner) {
            return runnerSuccess ? 0 : pre;
        }
        if (gameplayClass == HansomeTypes.GameplayClass.Lucky) {
            return luckySuccess ? 0 : pre;
        }
        if (gameplayClass == HansomeTypes.GameplayClass.Guardian) {
            return pre / 2;
        }
        return pre;
    }

    function settle(
        uint256 rd,
        AlpacaInput[] memory alpacas,
        CougarInput[] memory cougars
    ) internal pure returns (SettlementResult memory result) {
        (uint256 ra, uint256 rc, uint256 rh, uint256 splitDust) = splitDailyPool(rd);

        uint256[5] memory ad;
        uint256[5] memory cd;
        for (uint256 i = 0; i < alpacas.length; i++) {
            ad[alpacas[i].locationId]++;
        }
        for (uint256 j = 0; j < cougars.length; j++) {
            cd[cougars[j].locationId]++;
        }

        result.alpacaTokenIds = new uint256[](alpacas.length);
        result.alpacaNets = new uint256[](alpacas.length);
        result.cougarTokenIds = new uint256[](cougars.length);
        result.cougarTotals = new uint256[](cougars.length);

        uint256 unallocated = splitDust;
        uint256 pen;
        uint256 alpacaNetSum;
        uint256 cougarSum;
        uint256 huntDust;

        if (alpacas.length == 0) {
            unallocated += ra;
        } else {
            uint256[] memory omegas = new uint256[](alpacas.length);
            uint256 omegaSum;
            for (uint256 i = 0; i < alpacas.length; i++) {
                omegas[i] = weightNumerator(alpacas[i].locationId, alpacas[i].gameplayClass);
                omegaSum += omegas[i];
            }
            uint256 grossAssigned;
            for (uint256 i = 0; i < alpacas.length; i++) {
                uint256 gross = (i + 1 == alpacas.length)
                    ? (ra - grossAssigned)
                    : (ra * omegas[i]) / omegaSum;
                if (i + 1 != alpacas.length) grossAssigned += gross;

                uint8 loc = alpacas[i].locationId;
                uint256 piBps = resolvePenaltyBps(
                    loc,
                    ad[loc],
                    cd[loc],
                    alpacas[i].gameplayClass,
                    alpacas[i].runnerSuccess,
                    alpacas[i].luckySuccess
                );
                uint256 p = (gross * piBps) / GameTypes.BPS;
                uint256 net = gross - p;
                pen += p;
                alpacaNetSum += net;
                result.alpacaTokenIds[i] = alpacas[i].tokenId;
                result.alpacaNets[i] = net;
            }
        }

        if (cougars.length == 0) {
            unallocated += rc + rh;
        } else {
            uint256 baseAssigned;
            for (uint256 j = 0; j < cougars.length; j++) {
                uint256 base =
                    (j + 1 == cougars.length) ? (rc - baseAssigned) : (rc / cougars.length);
                if (j + 1 != cougars.length) baseAssigned += base;
                result.cougarTokenIds[j] = cougars[j].tokenId;
                result.cougarTotals[j] = base;
                cougarSum += base;
            }

            uint256 sigmaSum;
            uint256[] memory sigmas = new uint256[](cougars.length);
            uint256 lastSuccess = type(uint256).max;
            for (uint256 j = 0; j < cougars.length; j++) {
                uint8 loc = cougars[j].locationId;
                if (isHuntable(loc) && ad[loc] >= 1) {
                    sigmas[j] = ad[loc];
                    sigmaSum += sigmas[j];
                    lastSuccess = j;
                }
            }

            if (sigmaSum == 0) {
                huntDust = rh;
                unallocated += rh;
            } else {
                uint256 huntAssigned;
                for (uint256 j = 0; j < cougars.length; j++) {
                    if (sigmas[j] == 0) continue;
                    uint256 hunt = (j == lastSuccess)
                        ? (rh - huntAssigned)
                        : (rh * sigmas[j]) / sigmaSum;
                    if (j != lastSuccess) huntAssigned += hunt;
                    result.cougarTotals[j] += hunt;
                    cougarSum += hunt;
                }
            }
        }

        result.pen = pen;
        result.huntDust = huntDust;
        result.unallocated = unallocated;
        result.playerTotal = alpacaNetSum + cougarSum;

        // pen stays in treasury (never left); unallocated stays; playerTotal reserved for claims
        if (result.playerTotal + pen + unallocated != rd) revert ConservationFailed();
    }

    function assertConservation(
        uint256 rd,
        uint256 playerTotal,
        uint256 pen,
        uint256 unallocated
    ) internal pure {
        if (playerTotal + pen + unallocated != rd) revert ConservationFailed();
    }
}
