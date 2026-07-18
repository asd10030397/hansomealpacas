// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRevealRandomness, IRevealRandomnessReceiver} from "./IRevealRandomness.sol";

/**
 * @title RevealRandomnessMock
 * @notice TEST / LOCAL ONLY entropy provider. Owner supplies the random word.
 * @dev NEVER use on mainnet. Production must use `VRFRevealAdapter` + Chainlink VRF (or equivalent).
 *      The NFT rejects owner fulfill — only `randomnessProvider` may call `fulfillRevealRandomWord`.
 */
contract RevealRandomnessMock is IRevealRandomness, Ownable {
    mapping(uint256 => address) public pendingConsumer;

    event RandomRequested(uint256 indexed requestId, address indexed consumer);
    event RandomFulfilled(uint256 indexed requestId, uint256 randomWord);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function requestRandomWord(address consumer, uint256 requestId) external override {
        require(consumer != address(0), "RevealMock: zero consumer");
        require(pendingConsumer[requestId] == address(0), "RevealMock: request exists");
        pendingConsumer[requestId] = consumer;
        emit RandomRequested(requestId, consumer);
    }

    function fulfill(uint256 requestId, uint256 randomWord) external onlyOwner {
        address consumer = pendingConsumer[requestId];
        require(consumer != address(0), "RevealMock: unknown request");
        delete pendingConsumer[requestId];
        IRevealRandomnessReceiver(consumer).fulfillRevealRandomWord(requestId, randomWord);
        emit RandomFulfilled(requestId, randomWord);
    }
}
