// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title HansomeAlpacas
 * @notice Fixed-supply ERC-20 for HANSOME ALPACAS ($HANSOME).
 * @dev No mint, blacklist, whitelist, transfer tax, owner controls, or honeypot logic.
 *      The entire supply is minted once to the recipient at deployment.
 */
contract HansomeAlpacas is ERC20 {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;

    constructor(address recipient) ERC20("Hansome Alpacas", "HANSOME") {
        require(recipient != address(0), "HansomeAlpacas: zero recipient");
        _mint(recipient, MAX_SUPPLY);
    }
}
