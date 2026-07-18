// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRewardDistributor
 * @notice Per-tokenId claimable bookkeeping. GDS §17.
 */
interface IRewardDistributor {
    function claimable(uint256 tokenId) external view returns (uint256);

    function credit(uint256 tokenId, uint256 amount) external;

    function claim(uint256 tokenId) external;

    function claimMany(uint256[] calldata tokenIds) external;
}
