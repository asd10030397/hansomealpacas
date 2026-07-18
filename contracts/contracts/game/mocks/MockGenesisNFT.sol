// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {HansomeTypes} from "../../genesis/HansomeTypes.sol";
import {IHansomeGenesis} from "../../genesis/IHansomeGenesis.sol";

/**
 * @title MockGenesisNFT
 * @notice Test-only Genesis stand-in with settable side/class.
 */
contract MockGenesisNFT is ERC721, IHansomeGenesis {
    mapping(uint256 => HansomeTypes.Side) private _side;
    mapping(uint256 => HansomeTypes.GameplayClass) private _class;
    mapping(uint256 => bool) private _revealed;
    bool public collectionRevealed = true;

    constructor() ERC721("Mock Genesis", "MGEN") {}

    function mint(address to, uint256 tokenId, HansomeTypes.Side side_, HansomeTypes.GameplayClass class_)
        external
    {
        _mint(to, tokenId);
        _side[tokenId] = side_;
        _class[tokenId] = class_;
        _revealed[tokenId] = true;
    }

    function setRevealed(uint256 tokenId, bool v) external {
        _revealed[tokenId] = v;
    }

    function setCollectionRevealed(bool v) external {
        collectionRevealed = v;
    }

    function side(uint256 tokenId) external view returns (HansomeTypes.Side) {
        return _side[tokenId];
    }

    function gameplayClass(uint256 tokenId) external view returns (HansomeTypes.GameplayClass) {
        return _class[tokenId];
    }

    function isRevealed(uint256 tokenId) external view returns (bool) {
        return _revealed[tokenId];
    }

    function isCollectionRevealed() external view returns (bool) {
        return collectionRevealed;
    }
}
