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
 * @notice Day FSM + Commit/Reveal + finalizeDay / creditBatch orchestration. GDS §6–§9.
 * @dev SettlementLib math unchanged. Execution is batched for Mainnet-scale N.
 *      Reads Genesis NFT only — never mutates NFT state.
 */
contract HansomeGame is IHansomeGame, Ownable, ReentrancyGuard {
    /// @notice Max tokens per relayer reveal tx (callers must chunk).
    uint256 public constant MAX_REVEAL_BATCH = 50;
    /// @notice Max distributor.credit calls per creditBatch tx.
    uint256 public constant MAX_CREDIT_BATCH = 50;

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

    /// @dev Outcomes finalized; treasury reserved. Blocks further reveals.
    mapping(uint256 => bool) private _finalized;
    /// @dev All credits written to RewardDistributor (claim-ready for the day).
    mapping(uint256 => bool) private _settled;
    /// @dev Credits alpaca[0..A) then cougar[0..C); range [0, A+C].
    mapping(uint256 => uint256) private _creditCursor;
    mapping(uint256 => uint256) private _dayRd;
    mapping(uint256 => uint256) private _dayPen;
    mapping(uint256 => uint256) private _dayHuntDust;
    mapping(uint256 => uint256) private _dayUnallocated;
    mapping(uint256 => uint256) private _dayPlayerTotal;

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
    error AlreadyFinalized();
    error NotFinalized();
    error SeedMissing();
    error SafeMode();
    error CommitGloballyPaused();
    error InsufficientTreasury();
    error InvalidDayTiming();
    error TestnetUnlockForbidden();
    error BadTestnetIdentities();
    error LengthMismatch();
    error BatchTooLarge();

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
    event CreditsBatch(
        uint256 indexed day, uint256 fromCursor, uint256 toCursor, bool done
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
        // Finalized or fully credited ⇒ no more reveals (same FSM gate as legacy settle).
        if (_finalized[day] || _settled[day]) return GameTypes.DayState.Claimable;
        if (block.timestamp < dayZero) return GameTypes.DayState.Idle;

        uint256 start = dayZero + day * dayLength;
        uint256 commitEnd = start + commitDuration;
        uint256 revealEnd = start + commitDuration + revealDuration;

        if (block.timestamp < start) return GameTypes.DayState.Idle;
        if (block.timestamp < commitEnd) return GameTypes.DayState.CommitOpen;
        if (block.timestamp < revealEnd) return GameTypes.DayState.RevealOpen;
        return GameTypes.DayState.RevealClosed;
    }

    function isSettled(uint256 day) external view returns (bool) {
        return _settled[day];
    }

    function isFinalized(uint256 day) external view returns (bool) {
        return _finalized[day];
    }

    /// @notice Credit cursor and total credit slots (alpacaCount + cougarCount after finalize).
    function creditProgress(uint256 day)
        external
        view
        returns (uint256 cursor, uint256 total, bool finalized, bool settled)
    {
        finalized = _finalized[day];
        settled = _settled[day];
        cursor = _creditCursor[day];
        total = _alpacaIds[day].length + _cougarIds[day].length;
    }

    /**
     * @notice Reward amount for a revealed token after finalize (0 if absent).
     * @dev Recomputes SettlementLib in a view — same math as creditBatch.
     */
    function pendingRewardOf(uint256 tokenId, uint256 day) external view returns (uint256) {
        if (!_finalized[day]) return 0;
        SettlementLib.SettlementResult memory r = _computeSettlement(day);
        for (uint256 i = 0; i < r.alpacaTokenIds.length; i++) {
            if (r.alpacaTokenIds[i] == tokenId) return r.alpacaNets[i];
        }
        for (uint256 j = 0; j < r.cougarTokenIds.length; j++) {
            if (r.cougarTokenIds[j] == tokenId) return r.cougarTotals[j];
        }
        return 0;
    }

    function daySettlementTotals(uint256 day)
        external
        view
        returns (
            uint256 rd,
            uint256 pen,
            uint256 huntDust,
            uint256 unallocated,
            uint256 playerTotal
        )
    {
        return (
            _dayRd[day],
            _dayPen[day],
            _dayHuntDust[day],
            _dayUnallocated[day],
            _dayPlayerTotal[day]
        );
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
     * @dev Forbidden on Mainnet (chainid 4663). Batch size capped at MAX_REVEAL_BATCH.
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
        if (n > MAX_REVEAL_BATCH) revert BatchTooLarge();
        for (uint256 i = 0; i < n; i++) {
            if (_revealed[tokenIds[i]][day]) continue;
            _applyReveal(tokenIds[i], day, locationIds[i], salts[i]);
        }
    }

    /**
     * @notice Run SettlementLib once, reserve treasury, emit DaySettled (no per-token credit).
     * @dev Peak-gas safe: does not SSTORE per-token nets. creditBatch recomputes tables.
     */
    function finalizeDay(uint256 day) external nonReentrant {
        _finalizeDay(day);
    }

    /**
     * @notice Credit up to `limit` tokens (capped at MAX_CREDIT_BATCH). Permissionless.
     * @dev Recomputes SettlementLib in-memory (identical to finalize) then credits a slice.
     */
    function creditBatch(uint256 day, uint256 limit) external nonReentrant returns (uint256) {
        return _creditBatch(day, limit);
    }

    /**
     * @notice Legacy convenience: finalize + one credit batch (small-N / tests).
     * @dev For full credits at large N, call creditBatch until isSettled. A full while-loop
     *      in one tx can OOG — production relayer must chunk.
     */
    function settleDay(uint256 day) external nonReentrant {
        if (_settled[day]) revert AlreadySettled();
        if (!_finalized[day]) {
            _finalizeDay(day);
        }
        if (!_settled[day]) {
            _creditBatch(day, MAX_CREDIT_BATCH);
        }
        // Drain remaining batches while gas allows (small-N completes in one tx).
        while (!_settled[day] && gasleft() > 2_000_000) {
            _creditBatch(day, MAX_CREDIT_BATCH);
        }
    }

    function alpacaCount(uint256 day) external view returns (uint256) {
        return _alpacaIds[day].length;
    }

    function cougarCount(uint256 day) external view returns (uint256) {
        return _cougarIds[day].length;
    }

    function _settlePhaseOk(uint256 day) internal view returns (bool) {
        // When already finalized, dayState is Claimable — phase check uses raw clock.
        if (_finalized[day]) return false;
        uint256 start = dayZero + day * dayLength;
        uint256 commitEnd = start + commitDuration;
        uint256 revealEnd = start + commitDuration + revealDuration;
        if (block.timestamp < commitEnd) return false;
        // Mainnet: only after Reveal closes. Testnet: as soon as Reveal opens.
        if (block.chainid == 4663) {
            return block.timestamp >= revealEnd;
        }
        return block.timestamp >= commitEnd;
    }

    function _finalizeDay(uint256 day) internal {
        if (_settled[day]) revert AlreadySettled();
        if (_finalized[day]) revert AlreadyFinalized();
        if (!_settlePhaseOk(day)) revert WrongPhase();
        if (!randomness.hasDaySeed(day)) revert SeedMissing();

        uint256 g = treasury.spendable();
        uint256 rd = emission.currentRd(g);
        if (rd > g) revert InsufficientTreasury();

        SettlementLib.SettlementResult memory r = _computeSettlementWithRd(day, rd);

        if (r.playerTotal > 0) {
            treasury.reserveForClaims(r.playerTotal);
        }

        _dayRd[day] = rd;
        _dayPen[day] = r.pen;
        _dayHuntDust[day] = r.huntDust;
        _dayUnallocated[day] = r.unallocated;
        _dayPlayerTotal[day] = r.playerTotal;
        _creditCursor[day] = 0;
        _finalized[day] = true;

        if (_alpacaIds[day].length + _cougarIds[day].length == 0) {
            _settled[day] = true;
        }

        emit DaySettled(day, rd, r.pen, r.huntDust, r.unallocated, r.playerTotal);
    }

    function _creditBatch(uint256 day, uint256 limit) internal returns (uint256 credited) {
        if (!_finalized[day]) revert NotFinalized();
        if (_settled[day]) revert AlreadySettled();

        uint256 cap = limit > MAX_CREDIT_BATCH ? MAX_CREDIT_BATCH : limit;
        if (cap == 0) return 0;

        // Recompute identical SettlementLib tables (no per-token SSTORE on finalize).
        SettlementLib.SettlementResult memory r = _computeSettlement(day);

        uint256 aLen = r.alpacaTokenIds.length;
        uint256 cLen = r.cougarTokenIds.length;
        uint256 total = aLen + cLen;
        uint256 cursor = _creditCursor[day];
        uint256 from = cursor;
        uint256 end = cursor + cap;
        if (end > total) end = total;

        for (; cursor < end; cursor++) {
            if (cursor < aLen) {
                uint256 amt = r.alpacaNets[cursor];
                if (amt > 0) distributor.credit(r.alpacaTokenIds[cursor], amt);
            } else {
                uint256 j = cursor - aLen;
                uint256 amt = r.cougarTotals[j];
                if (amt > 0) distributor.credit(r.cougarTokenIds[j], amt);
            }
            credited++;
        }

        _creditCursor[day] = cursor;
        bool done = cursor >= total;
        if (done) {
            _settled[day] = true;
        }
        emit CreditsBatch(day, from, cursor, done);
    }

    function _computeSettlement(uint256 day)
        internal
        view
        returns (SettlementLib.SettlementResult memory)
    {
        uint256 rd = _finalized[day] ? _dayRd[day] : emission.currentRd(treasury.spendable());
        return _computeSettlementWithRd(day, rd);
    }

    function _computeSettlementWithRd(uint256 day, uint256 rd)
        internal
        view
        returns (SettlementLib.SettlementResult memory)
    {
        SettlementLib.AlpacaInput[] memory alpacas =
            new SettlementLib.AlpacaInput[](_alpacaIds[day].length);
        for (uint256 i = 0; i < _alpacaIds[day].length; i++) {
            uint256 tokenId = _alpacaIds[day][i];
            uint8 loc = _location[tokenId][day];
            HansomeTypes.GameplayClass class_ = _classOf(tokenId);
            bool runnerOk = false;
            bool luckyOk = false;
            if (class_ == HansomeTypes.GameplayClass.Runner) {
                runnerOk =
                    randomness.bernoulli(day, tokenId, GameTypes.PURPOSE_RUNNER, GameTypes.P_RUNNER_BPS);
            } else if (class_ == HansomeTypes.GameplayClass.Lucky) {
                luckyOk =
                    randomness.bernoulli(day, tokenId, GameTypes.PURPOSE_LUCKY, GameTypes.P_LUCKY_BPS);
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

        return SettlementLib.settle(rd, alpacas, cougars);
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
