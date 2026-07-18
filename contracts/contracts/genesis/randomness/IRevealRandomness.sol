// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRevealRandomness
 * @notice Pluggable entropy source for Genesis collection reveal.
 * @dev Production may wrap Chainlink VRF / a beacon; tests use RevealRandomnessMock.
 *      The NFT contract is the consumer; the provider calls back with a random word.
 */
interface IRevealRandomness {
    /// @notice Called by the Genesis NFT when reveal entropy is needed.
    /// @param consumer The NFT contract awaiting fulfillment.
    /// @param requestId Correlation id chosen by the consumer.
    function requestRandomWord(address consumer, uint256 requestId) external;
}

/**
 * @title IRevealRandomnessReceiver
 * @notice Callback implemented by HansomeGenesisNFT.
 */
interface IRevealRandomnessReceiver {
    function fulfillRevealRandomWord(uint256 requestId, uint256 randomWord) external;
}
