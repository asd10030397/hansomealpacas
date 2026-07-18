// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HansomeTypes
 * @notice Shared enums and constants for HANSOME Genesis NFT.
 * @dev Gameplay formulas live in GDS v1.1 — this file only encodes on-chain identity labels.
 */
library HansomeTypes {
    enum Side {
        None,
        Alpaca,
        Cougar
    }

    /// @dev For Cougars, class must remain None. King exists only on Reserved #001.
    enum GameplayClass {
        None,
        Common,
        Guardian,
        Farmer,
        Lucky,
        Runner,
        King
    }

    uint256 internal constant MAX_SUPPLY = 550;
    uint256 internal constant RESERVED_COUNT = 10;
    uint256 internal constant WHITELIST_CAP = 100;
    uint256 internal constant PUBLIC_CAP = 440;
    uint256 internal constant SALE_CAP = 540; // 100 + 440
    uint256 internal constant FIRST_SALE_ID = 11; // 1..10 reserved
    uint256 internal constant LAST_TOKEN_ID = 550;

    uint256 internal constant WL_WALLET_MAX = 1;
    uint256 internal constant PUBLIC_WALLET_MAX = 5;
    uint256 internal constant COMBINED_WALLET_MAX = 6;

    uint256 internal constant WL_EARLY_SECONDS = 1 hours;
    uint96 internal constant ROYALTY_BPS = 500; // 5%
}
