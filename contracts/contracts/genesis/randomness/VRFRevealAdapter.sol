// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRevealRandomness, IRevealRandomnessReceiver} from "./IRevealRandomness.sol";

/**
 * @title VRFRevealAdapter
 * @notice Production-oriented randomness adapter for HansomeGenesisNFT.
 * @dev Wire `vrfOperator` to a Chainlink VRF coordinator consumer (or equivalent beacon)
 *      that calls `fulfill(requestId, randomWord)`. The NFT must set `randomnessProvider`
 *      to this adapter. Owner cannot fulfill through the NFT directly.
 *
 *      Flow:
 *        1. NFT.requestReveal → adapter.requestRandomWord
 *        2. Off-chain / VRF service obtains entropy
 *        3. vrfOperator calls adapter.fulfill → NFT.fulfillRevealRandomWord
 *
 *      Do NOT use RevealRandomnessMock on mainnet.
 */
contract VRFRevealAdapter is IRevealRandomness, Ownable {
    IRevealRandomnessReceiver public consumer;
    address public vrfOperator;

    mapping(uint256 => bool) public pending;

    event ConsumerUpdated(address consumer);
    event VrfOperatorUpdated(address operator);
    event RandomnessRequested(uint256 indexed requestId, address indexed consumer);
    event RandomnessFulfilled(uint256 indexed requestId, uint256 randomWord);

    error ZeroAddress();
    error NotOperator();
    error UnknownRequest();
    error UnauthorizedRequester();

    constructor(address initialOwner, address vrfOperator_) Ownable(initialOwner) {
        if (vrfOperator_ == address(0)) revert ZeroAddress();
        vrfOperator = vrfOperator_;
    }

    function setConsumer(address consumer_) external onlyOwner {
        if (consumer_ == address(0)) revert ZeroAddress();
        consumer = IRevealRandomnessReceiver(consumer_);
        emit ConsumerUpdated(consumer_);
    }

    function setVrfOperator(address operator) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        vrfOperator = operator;
        emit VrfOperatorUpdated(operator);
    }

    /// @inheritdoc IRevealRandomness
    function requestRandomWord(address consumer_, uint256 requestId) external override {
        if (address(consumer) == address(0)) revert ZeroAddress();
        if (msg.sender != address(consumer)) revert UnauthorizedRequester();
        if (consumer_ != address(consumer)) revert UnauthorizedRequester();
        pending[requestId] = true;
        emit RandomnessRequested(requestId, consumer_);
        // Production: subclass or external keeper starts Chainlink VRF request keyed by requestId.
    }

    /**
     * @notice Deliver VRF/beacon entropy to the NFT consumer.
     * @dev Only `vrfOperator` (Chainlink callback contract / beacon relayer).
     */
    function fulfill(uint256 requestId, uint256 randomWord) external {
        if (msg.sender != vrfOperator) revert NotOperator();
        if (!pending[requestId]) revert UnknownRequest();
        delete pending[requestId];
        consumer.fulfillRevealRandomWord(requestId, randomWord);
        emit RandomnessFulfilled(requestId, randomWord);
    }
}
