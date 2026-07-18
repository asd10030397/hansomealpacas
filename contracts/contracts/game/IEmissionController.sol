// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IEmissionController
 * @notice Daily Rd from G bands + safe mode. GDS §15.
 */
interface IEmissionController {
    function currentRd(uint256 spendableG) external view returns (uint256 rd);

    function isSafeMode(uint256 spendableG) external view returns (bool);
}
