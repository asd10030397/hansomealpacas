// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IGameTreasury
 * @notice Holds HANSOME for the game; no minting. GDS §13.
 */
interface IGameTreasury {
    function token() external view returns (address);

    /// @notice Spendable treasury G (balance minus reserved claim liabilities).
    function spendable() external view returns (uint256);

    function outstandingClaims() external view returns (uint256);

    /// @notice Reserve `amount` from spendable for future claims. Only game/distributor path.
    function reserveForClaims(uint256 amount) external;

    /// @notice Pay claim to `to`, reducing outstanding reserved amount.
    function payClaim(address to, uint256 amount) external;

    /// @notice Credit tokens already received (sinks) — no-op on balance, for events/hooks.
    function onCredit(uint256 amount) external;
}
