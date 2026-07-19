// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestHANSOME (tHANSOME)
 * @notice TEST-ONLY ERC-20 reward token for Robinhood Testnet gameplay validation.
 * @dev DO NOT deploy to Robinhood Mainnet.
 *      DO NOT treat this as the real $HANSOME token (`HansomeAlpacas`).
 *
 *      Simple OpenZeppelin ERC-20 + owner mint for test funding.
 *      No taxes, transfer restrictions, blacklist, upgradeability, or other mechanics.
 *
 *      Intended flow: Mint NFT → Commit → Reveal → Settlement → Claim tHANSOME.
 */
contract TestHANSOME is ERC20, Ownable {
    /// @notice Canonical test supply target (1_000_000_000 × 10^18).
    uint256 public constant TEST_SUPPLY = 1_000_000_000 ether;

    constructor(address initialHolder) ERC20("Test HANSOME", "tHANSOME") Ownable(msg.sender) {
        require(initialHolder != address(0), "TestHANSOME: zero holder");
        _mint(initialHolder, TEST_SUPPLY);
    }

    /**
     * @notice Owner-only mint for additional test funding.
     * @dev Allowed only so testnet operators can top up after burns/transfers.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "TestHANSOME: zero to");
        _mint(to, amount);
    }
}
