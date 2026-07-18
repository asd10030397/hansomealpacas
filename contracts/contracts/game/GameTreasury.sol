// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IGameTreasury} from "./IGameTreasury.sol";

/**
 * @title GameTreasury
 * @notice Holds HANSOME; reserves claim liabilities; never mints. GDS §13.
 */
contract GameTreasury is IGameTreasury, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 private immutable _token;

    address public game;
    address public distributor;
    address public sinkRegistry;

    uint256 public override outstandingClaims;

    error NotAuthorized();
    error InsufficientSpendable();
    error ZeroAddress();

    event GameSet(address indexed game);
    event DistributorSet(address indexed distributor);
    event SinkRegistrySet(address indexed sinkRegistry);
    event Reserved(uint256 amount, uint256 outstanding);
    event ClaimPaid(address indexed to, uint256 amount);
    event Credited(uint256 amount);

    constructor(address token_, address initialOwner) Ownable(initialOwner) {
        if (token_ == address(0)) revert ZeroAddress();
        _token = IERC20(token_);
    }

    function token() external view returns (address) {
        return address(_token);
    }

    function setGame(address game_) external onlyOwner {
        if (game_ == address(0)) revert ZeroAddress();
        game = game_;
        emit GameSet(game_);
    }

    function setDistributor(address distributor_) external onlyOwner {
        if (distributor_ == address(0)) revert ZeroAddress();
        distributor = distributor_;
        emit DistributorSet(distributor_);
    }

    function setSinkRegistry(address sinkRegistry_) external onlyOwner {
        if (sinkRegistry_ == address(0)) revert ZeroAddress();
        sinkRegistry = sinkRegistry_;
        emit SinkRegistrySet(sinkRegistry_);
    }

    function spendable() public view returns (uint256) {
        uint256 bal = _token.balanceOf(address(this));
        if (bal < outstandingClaims) return 0;
        return bal - outstandingClaims;
    }

    function reserveForClaims(uint256 amount) external {
        if (msg.sender != game) revert NotAuthorized();
        if (amount > spendable()) revert InsufficientSpendable();
        outstandingClaims += amount;
        emit Reserved(amount, outstandingClaims);
    }

    function payClaim(address to, uint256 amount) external nonReentrant {
        if (msg.sender != distributor) revert NotAuthorized();
        if (amount > outstandingClaims) revert InsufficientSpendable();
        outstandingClaims -= amount;
        _token.safeTransfer(to, amount);
        emit ClaimPaid(to, amount);
    }

    function onCredit(uint256 amount) external {
        if (msg.sender != sinkRegistry && msg.sender != game) revert NotAuthorized();
        emit Credited(amount);
    }
}
