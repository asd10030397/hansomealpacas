// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IGameRandomness
 * @notice Day seed + Bernoulli rolls for Runner/Lucky. GDS §16.
 */
interface IGameRandomness {
    function daySeed(uint256 day) external view returns (bytes32);

    function hasDaySeed(uint256 day) external view returns (bool);

    /// @notice Bernoulli(pBps/10000) from (seed_d, tokenId, purpose).
    function bernoulli(uint256 day, uint256 tokenId, uint8 purpose, uint256 pBps)
        external
        view
        returns (bool);
}
