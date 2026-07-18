// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HansomeTypes} from "../../genesis/HansomeTypes.sol";
import {SettlementLib} from "../SettlementLib.sol";

/**
 * @title SettlementLibHarness
 * @notice Exposes SettlementLib for unit tests.
 */
contract SettlementLibHarness {
    function locationWeight(uint8 locationId) external pure returns (uint256) {
        return SettlementLib.locationWeight(locationId);
    }

    function pi0Bps(uint8 locationId) external pure returns (uint256) {
        return SettlementLib.pi0Bps(locationId);
    }

    function isLocationLegal(HansomeTypes.Side side, uint8 locationId) external pure returns (bool) {
        return SettlementLib.isLocationLegal(side, locationId);
    }

    function splitDailyPool(uint256 rd)
        external
        pure
        returns (uint256 ra, uint256 rc, uint256 rh, uint256 dust)
    {
        return SettlementLib.splitDailyPool(rd);
    }

    function weightNumerator(uint8 locationId, HansomeTypes.GameplayClass gameplayClass)
        external
        pure
        returns (uint256)
    {
        return SettlementLib.weightNumerator(locationId, gameplayClass);
    }

    function prePenaltyBps(uint8 locationId, uint256 adL, uint256 cdL) external pure returns (uint256) {
        return SettlementLib.prePenaltyBps(locationId, adL, cdL);
    }

    function resolvePenaltyBps(
        uint8 locationId,
        uint256 adL,
        uint256 cdL,
        HansomeTypes.GameplayClass gameplayClass,
        bool runnerSuccess,
        bool luckySuccess
    ) external pure returns (uint256) {
        return SettlementLib.resolvePenaltyBps(
            locationId, adL, cdL, gameplayClass, runnerSuccess, luckySuccess
        );
    }

    function settle(
        uint256 rd,
        SettlementLib.AlpacaInput[] calldata alpacas,
        SettlementLib.CougarInput[] calldata cougars
    ) external pure returns (SettlementLib.SettlementResult memory) {
        return SettlementLib.settle(rd, alpacas, cougars);
    }
}
