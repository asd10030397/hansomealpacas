// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {HansomeTypes} from "../genesis/HansomeTypes.sol";
import {IHansomeGenesis} from "../genesis/IHansomeGenesis.sol";
import {GameTypes} from "./GameTypes.sol";
import {IHansomeGame} from "./IHansomeGame.sol";
import {IGameTreasury} from "./IGameTreasury.sol";
import {IEmissionController} from "./IEmissionController.sol";
import {IRewardDistributor} from "./IRewardDistributor.sol";
import {IGameRandomness} from "./IGameRandomness.sol";
import {SettlementLib} from "./SettlementLib.sol";

/**
 * @title HansomeGame
 * @notice Day FSM + Commit/Reveal + settleDay orchestration. GDS §6–§9.
 * @dev Reads Genesis NFT only — never mutates NFT state.
 */
contract HansomeGame is IHansomeGame, Ownable, ReentrancyGuard {
    IHansomeGenesis public immutable genesis;
    IERC721 public immutable nft;
    IGameTreasury public immutable treasury;
    IEmissionController public immutable emission;
    IRewardDistributor public immutable distributor;
    IGameRandomness public immutable randomness;

    uint256 public immutable dayZero;
    /// @notice Full day length in seconds (Commit + Reveal + optional Battle pad). Production: 24h.
    uint256 public immutable dayLength;
    /// @notice Commit window length in seconds. Production: 20h.
    uint256 public immutable commitDuration;
    /// @notice Reveal window length in seconds. Production: 4h. Settlement eligible when this ends.
    uint256 public immutable revealDuration;

    bool public commitPaused;

    /**
     * @dev TESTNET ONLY. When set, sale-token side/class for gameplay are read from
     * `_testnetAssigned` (540 bytes, token #11 = index 0) until Genesis `collectionRevealed`.
     * Mainnet (chainid 4663) cannot activate this path.
     */
    bool public testnetGameplayUnlock;
    bytes private _testnetAssigned;

    mapping(uint256 => mapping(uint256 => bytes32)) private _commitHash;
    mapping(uint256 => mapping(uint256 => bool)) private _committed;
    mapping(uint256 => mapping(uint256 => bool)) private _revealed;
    mapping(uint256 => mapping(uint256 => uint8)) private _location;

    mapping(uint256 => uint256[]) private _alpacaIds;
    mapping(uint256 => uint256[]) private _cougarIds;
    mapping(uint256 => bool) private _settled;

    error WrongPhase();
    error AlreadyCommitted();
    error AlreadyRevealed();
    error NotCommitted();
    error BadCommitHash();
    error IllegalLocation();
    error NotAuthorized();
    error TokenNotRevealed();
    error InvalidSide();
    error AlreadySettled();
    error SeedMissing();
    error SafeMode();
    error CommitGloballyPaused();
    error InsufficientTreasury();
    error InvalidDayTiming();
    error TestnetUnlockForbidden();
    error BadTestnetIdentities();
    error LengthMismatch();

    event Committed(uint256 indexed tokenId, uint256 indexed day, bytes32 commitHash);
    event Revealed(uint256 indexed tokenId, uint256 indexed day, uint8 locationId, HansomeTypes.Side side);
    event DaySettled(
        uint256 indexed day,
        uint256 rd,
        uint256 pen,
        uint256 huntDust,
        uint256 unallocated,
        uint256 playerTotal
    );
    event CommitPausedSet(bool paused);
    event TestnetGameplayUnlockSet(bool active, uint256 assignedLength);

    constructor(
        address genesis_,
        address treasury_,
        address emission_,
        address distributor_,
        address randomness_,
        uint256 dayZero_,
        uint256 dayLength_,
        uint256 commitDuration_,
        uint256 revealDuration_,
        address initialOwner
    ) Ownable(initialOwner) {
        if (
            commitDuration_ == 0 || revealDuration_ == 0
                || commitDuration_ + revealDuration_ > dayLength_
        ) {
            revert InvalidDayTiming();
        }
        genesis = IHansomeGenesis(genesis_);
        nft = IERC721(genesis_);
        treasury = IGameTreasury(treasury_);
        emission = IEmissionController(emission_);
        distributor = IRewardDistributor(distributor_);
        randomness = IGameRandomness(randomness_);
        dayZero = dayZero_;
        dayLength = dayLength_;
        commitDuration = commitDuration_;
        revealDuration = revealDuration_;
    }

    function setCommitPaused(bool paused_) external onlyOwner {
        commitPaused = paused_;
        emit CommitPausedSet(paused_);
    }

    /**
     * @notice Robinhood Testnet helper: unlock Commit/Reveal/Settle for sale NFTs before
     * Genesis sell-out + collection reveal. `assigned540[i]` is the packed identity for tokenId 11+i
     * (same packing as Genesis). Forbidden on Mainnet.
     */
    function setTestnetGameplayIdentities(bytes calldata assigned540) external onlyOwner {
        if (block.chainid == 4663) revert TestnetUnlockForbidden();
        if (assigned540.length != 540) revert BadTestnetIdentities();
        _testnetAssigned = assigned540;
        testnetGameplayUnlock = true;
        emit TestnetGameplayUnlockSet(true, assigned540.length);
    }

    function clearTestnetGameplayIdentities() external onlyOwner {
        if (block.chainid == 4663) revert TestnetUnlockForbidden();
        delete _testnetAssigned;
        testnetGameplayUnlock = false;
        emit TestnetGameplayUnlockSet(false, 0);
    }

    function currentDay() public view returns (uint256) {
        if (block.timestamp < dayZero) return 0;
        return (block.timestamp - dayZero) / dayLength;
    }

    function dayState(uint256 day) public view returns (GameTypes.DayState) {
        if (_settled[day]) return GameTypes.DayState.Claimable;
        if (block.timestamp < dayZero) return GameTypes.DayState.Idle;

        uint256 start = dayZero + day * dayLength;
        uint256 commitEnd = start + commitDuration;
        uint256 revealEnd = start + commitDuration + revealDuration;

        if (block.timestamp < start) return GameTypes.DayState.Idle;
        if (block.timestamp < commitEnd) return GameTypes.DayState.CommitOpen;
        if (block.timestamp < revealEnd) return GameTypes.DayState.RevealOpen;
        // RevealClosed through end of dayLength (Battle / settlement presentation pad on Testnet).
        return GameTypes.DayState.RevealClosed;
    }

    function isSettled(uint256 day) external view returns (bool) {
        return _settled[day];
    }

    function commitHashOf(uint256 tokenId, uint256 day) external view returns (bytes32) {
        return _commitHash[tokenId][day];
    }

    function locationOf(uint256 tokenId, uint256 day) external view returns (uint8) {
        return _location[tokenId][day];
    }

    function computeCommitHash(uint256 tokenId, uint256 day, uint8 locationId, bytes32 salt)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(tokenId, day, locationId, salt));
    }

    function commit(uint256 tokenId, uint256 day, bytes32 commitHash_) external {
        if (commitPaused) revert CommitGloballyPaused();
        if (dayState(day) != GameTypes.DayState.CommitOpen) revert WrongPhase();
        if (emission.isSafeMode(treasury.spendable())) revert SafeMode();
        _authorizePlayer(tokenId, msg.sender);
        if (_committed[tokenId][day]) revert AlreadyCommitted();

        _committed[tokenId][day] = true;
        _commitHash[tokenId][day] = commitHash_;
        emit Committed(tokenId, day, commitHash_);
    }

    function reveal(uint256 tokenId, uint256 day, uint8 locationId, bytes32 salt) external {
        if (dayState(day) != GameTypes.DayState.RevealOpen) revert WrongPhase();
        _authorizePlayer(tokenId, msg.sender);
        _applyReveal(tokenId, day, locationId, salt);
    }

    /**
     * @notice TESTNET ONLY — owner/relayer reveals commits without the NFT owner signing.
     * @dev Forbidden on Mainnet (chainid 4663). Mainnet players still use `reveal()`.
     *      Used so Testnet QA can auto-resolve after a single Commit wallet confirm.
     */
    function testnetRelayerRevealBatch(
        uint256[] calldata tokenIds,
        uint256 day,
        uint8[] calldata locationIds,
        bytes32[] calldata salts
    ) external onlyOwner {
        if (block.chainid == 4663) revert TestnetUnlockForbidden();
        if (dayState(day) != GameTypes.DayState.RevealOpen) revert WrongPhase();
        uint256 n = tokenIds.length;
        if (n != locationIds.length || n != salts.length) revert LengthMismatch();
        for (uint256 i = 0; i < n; i++) {
            if (_revealed[tokenIds[i]][day]) continue;
            _applyReveal(tokenIds[i], day, locationIds[i], salts[i]);
        }
    }

    function settleDay(uint256 day) external nonReentrant {
        if (_settled[day]) revert AlreadySettled();
        {
            // Mainnet: settle only after Reveal closes (commit–reveal security).
            // Testnet: allow settle as soon as Reveal opens so Battle can resolve
            // instantly; the remaining window is presentation-only.
            GameTypes.DayState s = dayState(day);
            bool ok = s == GameTypes.DayState.RevealClosed
                || (block.chainid != 4663 && s == GameTypes.DayState.RevealOpen);
            if (!ok) revert WrongPhase();
        }
        if (!randomness.hasDaySeed(day)) revert SeedMissing();

        uint256 g = treasury.spendable();
        uint256 rd = emission.currentRd(g);
        if (rd > g) revert InsufficientTreasury();

        SettlementLib.AlpacaInput[] memory alpacas =
            new SettlementLib.AlpacaInput[](_alpacaIds[day].length);
        for (uint256 i = 0; i < _alpacaIds[day].length; i++) {
            uint256 tokenId = _alpacaIds[day][i];
            uint8 loc = _location[tokenId][day];
            HansomeTypes.GameplayClass class_ = _classOf(tokenId);
            bool runnerOk = false;
            bool luckyOk = false;
            if (class_ == HansomeTypes.GameplayClass.Runner) {
                runnerOk = randomness.bernoulli(day, tokenId, GameTypes.PURPOSE_RUNNER, GameTypes.P_RUNNER_BPS);
            } else if (class_ == HansomeTypes.GameplayClass.Lucky) {
                luckyOk = randomness.bernoulli(day, tokenId, GameTypes.PURPOSE_LUCKY, GameTypes.P_LUCKY_BPS);
            }
            alpacas[i] = SettlementLib.AlpacaInput({
                tokenId: tokenId,
                locationId: loc,
                gameplayClass: class_,
                runnerSuccess: runnerOk,
                luckySuccess: luckyOk
            });
        }

        SettlementLib.CougarInput[] memory cougars =
            new SettlementLib.CougarInput[](_cougarIds[day].length);
        for (uint256 j = 0; j < _cougarIds[day].length; j++) {
            uint256 tokenId = _cougarIds[day][j];
            cougars[j] = SettlementLib.CougarInput({
                tokenId: tokenId,
                locationId: _location[tokenId][day]
            });
        }

        SettlementLib.SettlementResult memory r = SettlementLib.settle(rd, alpacas, cougars);

        if (r.playerTotal > 0) {
            treasury.reserveForClaims(r.playerTotal);
        }
        for (uint256 i = 0; i < r.alpacaTokenIds.length; i++) {
            if (r.alpacaNets[i] > 0) distributor.credit(r.alpacaTokenIds[i], r.alpacaNets[i]);
        }
        for (uint256 j = 0; j < r.cougarTokenIds.length; j++) {
            if (r.cougarTotals[j] > 0) distributor.credit(r.cougarTokenIds[j], r.cougarTotals[j]);
        }

        _settled[day] = true;
        emit DaySettled(day, rd, r.pen, r.huntDust, r.unallocated, r.playerTotal);
    }

    function alpacaCount(uint256 day) external view returns (uint256) {
        return _alpacaIds[day].length;
    }

    function cougarCount(uint256 day) external view returns (uint256) {
        return _cougarIds[day].length;
    }

    function _authorizePlayer(uint256 tokenId, address caller) internal view {
        if (!_isGameplayReady(tokenId)) revert TokenNotRevealed();
        HansomeTypes.Side side_ = _sideOf(tokenId);
        if (side_ == HansomeTypes.Side.None) revert InvalidSide();

        address owner = nft.ownerOf(tokenId);
        if (caller != owner && nft.getApproved(tokenId) != caller && !nft.isApprovedForAll(owner, caller)) {
            revert NotAuthorized();
        }
    }

    function _applyReveal(uint256 tokenId, uint256 day, uint8 locationId, bytes32 salt) internal {
        if (!_isGameplayReady(tokenId)) revert TokenNotRevealed();
        if (!_committed[tokenId][day]) revert NotCommitted();
        if (_revealed[tokenId][day]) revert AlreadyRevealed();

        bytes32 expected = computeCommitHash(tokenId, day, locationId, salt);
        if (expected != _commitHash[tokenId][day]) revert BadCommitHash();

        HansomeTypes.Side side_ = _sideOf(tokenId);
        if (!SettlementLib.isLocationLegal(side_, locationId)) revert IllegalLocation();

        _revealed[tokenId][day] = true;
        _location[tokenId][day] = locationId;

        if (side_ == HansomeTypes.Side.Alpaca) {
            _alpacaIds[day].push(tokenId);
        } else if (side_ == HansomeTypes.Side.Cougar) {
            _cougarIds[day].push(tokenId);
        } else {
            revert InvalidSide();
        }

        emit Revealed(tokenId, day, locationId, side_);
    }

    function _useTestnetIdentities() internal view returns (bool) {
        return testnetGameplayUnlock && !genesis.isCollectionRevealed() && _testnetAssigned.length == 540;
    }

    function _isGameplayReady(uint256 tokenId) internal view returns (bool) {
        if (genesis.isRevealed(tokenId)) return true;
        // Testnet unlock: all sale tokens (#11..#550) are playable before collection reveal.
        // Reserved #1..#10 still require on-chain Genesis reveal (King / founders).
        if (!_useTestnetIdentities()) return false;
        if (tokenId < HansomeTypes.FIRST_SALE_ID || tokenId > HansomeTypes.LAST_TOKEN_ID) {
            return false;
        }
        return true;
    }

    function _sideOf(uint256 tokenId) internal view returns (HansomeTypes.Side) {
        if (_useTestnetIdentities() && tokenId >= HansomeTypes.FIRST_SALE_ID) {
            (HansomeTypes.Side s,) = _unpackTestnet(uint8(_testnetAssigned[tokenId - HansomeTypes.FIRST_SALE_ID]));
            return s;
        }
        return genesis.side(tokenId);
    }

    function _classOf(uint256 tokenId) internal view returns (HansomeTypes.GameplayClass) {
        if (_useTestnetIdentities() && tokenId >= HansomeTypes.FIRST_SALE_ID) {
            (, HansomeTypes.GameplayClass c) =
                _unpackTestnet(uint8(_testnetAssigned[tokenId - HansomeTypes.FIRST_SALE_ID]));
            return c;
        }
        return genesis.gameplayClass(tokenId);
    }

    function _unpackTestnet(uint8 packed)
        private
        pure
        returns (HansomeTypes.Side s, HansomeTypes.GameplayClass c)
    {
        bool isCougar = (packed & 0x80) != 0;
        uint8 cls = packed & 0x0f;
        if (isCougar) {
            return (HansomeTypes.Side.Cougar, HansomeTypes.GameplayClass.None);
        }
        return (HansomeTypes.Side.Alpaca, HansomeTypes.GameplayClass(cls));
    }
}
