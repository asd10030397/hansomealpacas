// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GameTypes} from "./GameTypes.sol";
import {IEmissionController} from "./IEmissionController.sol";

/**
 * @title EmissionController
 * @notice GDS §15 emission bands. Immutable constants — no hot-edit of v1.1.
 */
contract EmissionController is IEmissionController {
    function currentRd(uint256 spendableG) external pure returns (uint256 rd) {
        if (spendableG < GameTypes.G_SAFE) {
            return 0; // safe mode: no fixed pool (E11 / §15.2)
        }
        if (spendableG >= (GameTypes.G0 * 70) / 100) {
            return GameTypes.R0; // 400_000
        }
        if (spendableG >= (GameTypes.G0 * 40) / 100) {
            return 280_000 ether;
        }
        if (spendableG >= (GameTypes.G0 * 20) / 100) {
            return 160_000 ether;
        }
        return 80_000 ether;
    }

    function isSafeMode(uint256 spendableG) external pure returns (bool) {
        return spendableG < GameTypes.G_SAFE;
    }
}
