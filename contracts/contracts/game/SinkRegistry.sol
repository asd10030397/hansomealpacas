// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {GameTypes} from "./GameTypes.sol";
import {IGameTreasury} from "./IGameTreasury.sol";

/**
 * @title SinkRegistry
 * @notice Player HANSOME → Treasury sinks. Prices not frozen in GDS v1.1. GDS §14.
 */
contract SinkRegistry is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    IGameTreasury public immutable treasury;

    bool public paused;

    error Paused();
    error ZeroAmount();
    error InvalidSink();

    event Sunk(GameTypes.SinkId indexed id, address indexed payer, uint256 amount);
    event PauseSet(bool paused);

    constructor(address token_, address treasury_, address initialOwner) Ownable(initialOwner) {
        token = IERC20(token_);
        treasury = IGameTreasury(treasury_);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PauseSet(paused_);
    }

    function sink(GameTypes.SinkId id, uint256 amount) external nonReentrant {
        if (paused) revert Paused();
        if (amount == 0) revert ZeroAmount();
        if (uint8(id) > uint8(GameTypes.SinkId.TraitReroll)) revert InvalidSink();

        token.safeTransferFrom(msg.sender, address(treasury), amount);
        treasury.onCredit(amount);
        emit Sunk(id, msg.sender, amount);
    }
}
