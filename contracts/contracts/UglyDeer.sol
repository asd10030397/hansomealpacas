// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title UglyDeer
 * @notice Fixed-supply ERC-20 for UGLY DEER ($UGLY).
 * @dev No mint, blacklist, whitelist, transfer tax, owner controls, or honeypot logic.
 *      The entire supply is minted once to the recipient at deployment.
 */
contract UglyDeer is ERC20 {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;

    constructor(address recipient) ERC20("Ugly Deer", "UGLY") {
        require(recipient != address(0), "UglyDeer: zero recipient");
        _mint(recipient, MAX_SUPPLY);
    }
}
