// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title GameTypes
 * @notice GDS v1.1 enums/constants for the daily game. No new mechanics.
 */
library GameTypes {
    enum DayState {
        Idle,
        CommitOpen,
        CommitClosed,
        RevealOpen,
        RevealClosed,
        Settlement,
        Claimable
    }

    enum SinkId {
        Upgrade,
        Item,
        Shield,
        SeasonEntry,
        TraitReroll
    }

    uint8 internal constant LOC_HOME = 0;
    uint8 internal constant LOC_MOUNTAIN = 1;
    uint8 internal constant LOC_GRASSLAND = 2;
    uint8 internal constant LOC_FOREST = 3;
    uint8 internal constant LOC_RIVER = 4;
    uint8 internal constant LOC_COUNT = 5;

    uint256 internal constant BPS = 10_000;
    uint256 internal constant FARMER_NUM = 120;
    uint256 internal constant FARMER_DEN = 100;
    uint256 internal constant MAX_PRE_PENALTY_BPS = 9_000;
    uint256 internal constant P_RUNNER_BPS = 3_000; // 0.30
    uint256 internal constant P_LUCKY_BPS = 2_000; // 0.20

    uint8 internal constant PURPOSE_RUNNER = 1;
    uint8 internal constant PURPOSE_LUCKY = 2;

    /// @dev Whole-token GDS amounts scaled to 18 decimals (HANSOME ERC-20).
    uint256 internal constant R0 = 400_000 ether;
    uint256 internal constant G0 = 300_000_000 ether;
    uint256 internal constant G_SAFE = 15_000_000 ether;

    uint256 internal constant DAY_LENGTH = 24 hours;
    uint256 internal constant COMMIT_DURATION = 20 hours;
    uint256 internal constant REVEAL_DURATION = 4 hours;
}
