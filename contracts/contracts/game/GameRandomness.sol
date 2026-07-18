// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGameRandomness} from "./IGameRandomness.sol";

/**
 * @title GameRandomness
 * @notice Day seed storage + deterministic Bernoulli. GDS §16.
 * @dev Production: only randomnessProvider fulfills seeds (VRF adapter). Owner sets provider.
 */
contract GameRandomness is IGameRandomness, Ownable {
    address public randomnessProvider;

    mapping(uint256 => bytes32) private _daySeed;

    error NotProvider();
    error SeedMissing();
    error SeedAlreadySet();
    error ZeroAddress();

    event RandomnessProviderSet(address indexed provider);
    event DaySeedSet(uint256 indexed day, bytes32 seed);

    constructor(address initialOwner) Ownable(initialOwner) {
        randomnessProvider = initialOwner;
    }

    function setRandomnessProvider(address provider) external onlyOwner {
        if (provider == address(0)) revert ZeroAddress();
        randomnessProvider = provider;
        emit RandomnessProviderSet(provider);
    }

    function fulfillDaySeed(uint256 day, bytes32 seed) external {
        if (msg.sender != randomnessProvider) revert NotProvider();
        if (_daySeed[day] != bytes32(0)) revert SeedAlreadySet();
        if (seed == bytes32(0)) revert SeedMissing();
        _daySeed[day] = seed;
        emit DaySeedSet(day, seed);
    }

    function daySeed(uint256 day) external view returns (bytes32) {
        return _daySeed[day];
    }

    function hasDaySeed(uint256 day) external view returns (bool) {
        return _daySeed[day] != bytes32(0);
    }

    function bernoulli(uint256 day, uint256 tokenId, uint8 purpose, uint256 pBps)
        external
        view
        returns (bool)
    {
        bytes32 seed = _daySeed[day];
        if (seed == bytes32(0)) revert SeedMissing();
        uint256 roll = uint256(keccak256(abi.encodePacked(seed, tokenId, purpose))) % 10_000;
        return roll < pBps;
    }
}
