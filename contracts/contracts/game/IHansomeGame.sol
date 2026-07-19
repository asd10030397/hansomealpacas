// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GameTypes} from "./GameTypes.sol";

/**
 * @title IHansomeGame
 * @notice Player/system API for Commit → Reveal → Settle → Claim orchestration.
 */
interface IHansomeGame {
    function currentDay() external view returns (uint256);

    function dayLength() external view returns (uint256);

    function commitDuration() external view returns (uint256);

    function revealDuration() external view returns (uint256);

    function dayState(uint256 day) external view returns (GameTypes.DayState);

    function commit(uint256 tokenId, uint256 day, bytes32 commitHash) external;

    function reveal(uint256 tokenId, uint256 day, uint8 locationId, bytes32 salt) external;

    function settleDay(uint256 day) external;

    function commitHashOf(uint256 tokenId, uint256 day) external view returns (bytes32);

    function locationOf(uint256 tokenId, uint256 day) external view returns (uint8);

    function isSettled(uint256 day) external view returns (bool);

    function computeCommitHash(uint256 tokenId, uint256 day, uint8 locationId, bytes32 salt)
        external
        pure
        returns (bytes32);
}
