// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRewardDistributor} from "./IRewardDistributor.sol";
import {IGameTreasury} from "./IGameTreasury.sol";

/**
 * @title RewardDistributor
 * @notice claimable[tokenId] bookkeeping; pull claims. GDS §17.
 */
contract RewardDistributor is IRewardDistributor, Ownable, ReentrancyGuard {
    IERC721 public immutable nft;
    IGameTreasury public immutable treasury;

    address public game;

    mapping(uint256 => uint256) private _claimable;

    error NotAuthorized();
    error NotTokenController();
    error ZeroAddress();
    error NothingToClaim();

    event GameSet(address indexed game);
    event Credited(uint256 indexed tokenId, uint256 amount);
    event Claimed(uint256 indexed tokenId, address indexed to, uint256 amount);

    constructor(address nft_, address treasury_, address initialOwner) Ownable(initialOwner) {
        if (nft_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        nft = IERC721(nft_);
        treasury = IGameTreasury(treasury_);
    }

    function setGame(address game_) external onlyOwner {
        if (game_ == address(0)) revert ZeroAddress();
        game = game_;
        emit GameSet(game_);
    }

    function claimable(uint256 tokenId) external view returns (uint256) {
        return _claimable[tokenId];
    }

    function credit(uint256 tokenId, uint256 amount) external {
        if (msg.sender != game) revert NotAuthorized();
        if (amount == 0) return;
        _claimable[tokenId] += amount;
        emit Credited(tokenId, amount);
    }

    function claim(uint256 tokenId) external nonReentrant {
        _claim(tokenId, msg.sender);
    }

    function claimMany(uint256[] calldata tokenIds) external nonReentrant {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _claim(tokenIds[i], msg.sender);
        }
    }

    function _claim(uint256 tokenId, address caller) internal {
        if (!_isAuthorized(caller, tokenId)) revert NotTokenController();
        uint256 amount = _claimable[tokenId];
        if (amount == 0) revert NothingToClaim();
        _claimable[tokenId] = 0;
        treasury.payClaim(caller, amount);
        emit Claimed(tokenId, caller, amount);
    }

    function _isAuthorized(address caller, uint256 tokenId) internal view returns (bool) {
        address owner = nft.ownerOf(tokenId);
        return caller == owner || nft.getApproved(tokenId) == caller || nft.isApprovedForAll(owner, caller);
    }
}
