// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HansomeTypes} from "./HansomeTypes.sol";

/**
 * @title IHansomeGenesis
 * @notice Game-facing identity API for the single HANSOME Genesis NFT collection.
 * @dev Ownership uses standard IERC721 (`ownerOf` / `balanceOf`). Game must trust
 *      on-chain side/class — never metadata alone.
 */
interface IHansomeGenesis {
    function side(uint256 tokenId) external view returns (HansomeTypes.Side);

    function gameplayClass(uint256 tokenId) external view returns (HansomeTypes.GameplayClass);

    /// @notice Per-token reveal status. Reserved tokens are revealed at mint; sale tokens only after full collection reveal.
    function isRevealed(uint256 tokenId) external view returns (bool);

    /// @notice True once every sale identity has been assigned and views expose side/class.
    function isCollectionRevealed() external view returns (bool);
}
