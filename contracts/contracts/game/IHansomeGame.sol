// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GameTypes} from "./GameTypes.sol";

/**
 * @title IHansomeGame
 * @notice Player/system API for Commit → Reveal → Finalize → Credit → Claim.
 */
interface IHansomeGame {
    function currentDay() external view returns (uint256);

    function dayLength() external view returns (uint256);

    function commitDuration() external view returns (uint256);

    function revealDuration() external view returns (uint256);

    function dayState(uint256 day) external view returns (GameTypes.DayState);

    function commit(uint256 tokenId, uint256 day, bytes32 commitHash) external;

    function reveal(uint256 tokenId, uint256 day, uint8 locationId, bytes32 salt) external;

    /// @notice Compute reward tables + reserve treasury (no per-token credit).
    function finalizeDay(uint256 day) external;

    /// @notice Credit up to `limit` tokens from stored tables (capped on-chain).
    function creditBatch(uint256 day, uint256 limit) external returns (uint256 credited);

    /// @notice Legacy: finalize + credit all (small-N / tests). May OOG at large N.
    function settleDay(uint256 day) external;

    function commitHashOf(uint256 tokenId, uint256 day) external view returns (bytes32);

    function locationOf(uint256 tokenId, uint256 day) external view returns (uint8);

    function isSettled(uint256 day) external view returns (bool);

    function isFinalized(uint256 day) external view returns (bool);

    function creditProgress(uint256 day)
        external
        view
        returns (uint256 cursor, uint256 total, bool finalized, bool settled);

    function pendingRewardOf(uint256 tokenId, uint256 day) external view returns (uint256);

    function computeCommitHash(uint256 tokenId, uint256 day, uint8 locationId, bytes32 salt)
        external
        pure
        returns (bytes32);
}
