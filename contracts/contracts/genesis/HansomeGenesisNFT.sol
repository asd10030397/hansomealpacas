// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {HansomeTypes} from "./HansomeTypes.sol";
import {IHansomeGenesis} from "./IHansomeGenesis.sol";
import {IRevealRandomness, IRevealRandomnessReceiver} from "./randomness/IRevealRandomness.sol";

/**
 * @title HansomeGenesisNFT
 * @notice Single ERC-721: 550 = 500 Alpaca + 50 Cougar. Hardened per Security Review v1.0.
 * @dev Supply / mint rules / reserved classes / GDS unchanged.
 *
 * Security hardening:
 * - saleIdentityCommitment locked before WL mint
 * - Admin params timelocked (default 24h; constructor may shorten for testnet only)
 * - Reveal fulfill only via randomnessProvider (VRF adapter) — no owner fulfill
 * - side/class views hidden until collection fully revealed (no partial API leak)
 * - reveal seed hidden until collection revealed
 * - Auto-freeze metadata when reveal completes
 * - Reveal requires full sale sell-out (540/540)
 */
contract HansomeGenesisNFT is ERC721, ERC2981, Ownable, ReentrancyGuard, IHansomeGenesis, IRevealRandomnessReceiver {
    using Strings for uint256;

    /// @notice Admin op delay. Pass `0` in the constructor for the production default (24 hours).
    uint256 public immutable ADMIN_TIMELOCK;

    // ─── Config ─────────────────────────────────────────────────────────
    uint256 public publicStart;
    uint256 public mintPrice;
    bytes32 public whitelistMerkleRoot;
    bytes32 public saleIdentityCommitment;
    bool public saleIdentityCommitmentLocked;
    string private _placeholderURI;
    string private _baseTokenURI;
    bool public metadataFrozen;
    bool public reservedMinted;
    bool public collectionRevealed;
    address public randomnessProvider;

    // ─── Supply counters ────────────────────────────────────────────────
    uint256 public nextSaleTokenId = HansomeTypes.FIRST_SALE_ID;
    uint256 public whitelistMinted;
    uint256 public publicMinted;

    mapping(address => uint256) public whitelistMintCount;
    mapping(address => uint256) public publicMintCount;

    // ─── On-chain identity (sale values hidden via views until collectionRevealed) ──
    mapping(uint256 => HansomeTypes.Side) private _side;
    mapping(uint256 => HansomeTypes.GameplayClass) private _gameplayClass;

    // ─── Reveal pipeline ────────────────────────────────────────────────
    bytes private _pendingSaleIdentities;
    uint256 public revealRequestId;
    bool public revealRequested;
    bool public revealEntropyReady;
    uint256 private _revealRandomWord; // private until collectionRevealed
    uint256 public revealCursor;
    uint256 private _fyRemaining;
    mapping(uint256 => uint256) private _fy;

    // ─── Timelock ───────────────────────────────────────────────────────
    mapping(bytes32 => uint256) public pendingAdminOps; // opId => eta

    // ─── Events ─────────────────────────────────────────────────────────
    event AdminOpScheduled(bytes32 indexed opId, uint256 eta);
    event AdminOpExecuted(bytes32 indexed opId);
    event AdminOpCancelled(bytes32 indexed opId);
    event SaleIdentityCommitmentUpdated(bytes32 commitment);
    event SaleIdentityCommitmentLocked(bytes32 commitment);
    event MintPriceUpdated(uint256 mintPrice);
    event PublicStartUpdated(uint256 publicStart);
    event WhitelistMerkleRootUpdated(bytes32 root);
    event PlaceholderURIUpdated(string uri);
    event BaseURIUpdated(string uri);
    event MetadataFrozen(string baseURI);
    event RandomnessProviderUpdated(address provider);
    event ReservedMinted(address indexed to);
    event SaleMinted(address indexed to, uint256 indexed tokenId, bool whitelist);
    event RevealRequested(uint256 indexed requestId, bytes32 identityHash);
    event RevealEntropyReady(uint256 indexed requestId);
    event RevealProgress(uint256 assigned, uint256 total);
    event CollectionRevealed(bytes32 identityHash);
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAddress();
    error InvalidConfig();
    error SaleNotConfigured();
    error CommitmentLocked();
    error CommitmentNotLocked();
    error ReservedAlreadyMinted();
    error ReservedNotMinted();
    error WhitelistNotOpen();
    error PublicNotOpen();
    error WhitelistClosed();
    error ExceedsWalletCap();
    error ExceedsPhaseCap();
    error ExceedsSupply();
    error InvalidProof();
    error IncorrectPayment();
    error AlreadyRevealed();
    error RevealNotReady();
    error RevealAlreadyRequested();
    error BadIdentityLength();
    error BadIdentityCommitment();
    error BadIdentityComposition();
    error UnauthorizedRandomness();
    error MetadataIsFrozen();
    error BaseURIRequired();
    error SaleIncomplete();
    error TimelockNotScheduled();
    error TimelockNotReady();
    error RevealSeedHidden();

    bytes32 private constant OP_MINT_PRICE = keccak256("MINT_PRICE");
    bytes32 private constant OP_PUBLIC_START = keccak256("PUBLIC_START");
    bytes32 private constant OP_MERKLE = keccak256("MERKLE");
    bytes32 private constant OP_PROVIDER = keccak256("PROVIDER");
    bytes32 private constant OP_PLACEHOLDER = keccak256("PLACEHOLDER");
    bytes32 private constant OP_WITHDRAW = keccak256("WITHDRAW");

    constructor(
        address initialOwner,
        address royaltyReceiver,
        address randomnessProvider_,
        string memory placeholderURI_,
        uint256 adminTimelock_
    ) ERC721("HANSOME Genesis NFT", "HGEN") Ownable(initialOwner) {
        if (initialOwner == address(0) || royaltyReceiver == address(0) || randomnessProvider_ == address(0)) {
            revert ZeroAddress();
        }
        // 0 => production default (24h). Non-zero values are for testnet / local bootstrap only.
        ADMIN_TIMELOCK = adminTimelock_ == 0 ? 24 hours : adminTimelock_;
        _placeholderURI = placeholderURI_;
        randomnessProvider = randomnessProvider_;
        _setDefaultRoyalty(royaltyReceiver, HansomeTypes.ROYALTY_BPS);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Timelock helpers
    // ═══════════════════════════════════════════════════════════════════

    function _opId(bytes32 kind, bytes32 arg) private pure returns (bytes32) {
        return keccak256(abi.encode(kind, arg));
    }

    function _schedule(bytes32 opId) private {
        uint256 eta = block.timestamp + ADMIN_TIMELOCK;
        pendingAdminOps[opId] = eta;
        emit AdminOpScheduled(opId, eta);
    }

    function _consume(bytes32 opId) private {
        uint256 eta = pendingAdminOps[opId];
        if (eta == 0) revert TimelockNotScheduled();
        if (block.timestamp < eta) revert TimelockNotReady();
        delete pendingAdminOps[opId];
        emit AdminOpExecuted(opId);
    }

    function cancelAdminOp(bytes32 opId) external onlyOwner {
        if (pendingAdminOps[opId] == 0) revert TimelockNotScheduled();
        delete pendingAdminOps[opId];
        emit AdminOpCancelled(opId);
    }

    // ── schedule / execute: mint price ──────────────────────────────────
    function scheduleMintPrice(uint256 priceWei) external onlyOwner {
        _schedule(_opId(OP_MINT_PRICE, bytes32(priceWei)));
    }

    function executeMintPrice(uint256 priceWei) external onlyOwner {
        _consume(_opId(OP_MINT_PRICE, bytes32(priceWei)));
        mintPrice = priceWei;
        emit MintPriceUpdated(priceWei);
    }

    // ── schedule / execute: public start (also locks commitment) ────────
    function schedulePublicStart(uint256 timestamp) external onlyOwner {
        _schedule(_opId(OP_PUBLIC_START, bytes32(timestamp)));
    }

    function executePublicStart(uint256 timestamp) external onlyOwner {
        _consume(_opId(OP_PUBLIC_START, bytes32(timestamp)));
        if (saleIdentityCommitment == bytes32(0)) revert SaleNotConfigured();
        if (!saleIdentityCommitmentLocked) {
            saleIdentityCommitmentLocked = true;
            emit SaleIdentityCommitmentLocked(saleIdentityCommitment);
        }
        publicStart = timestamp;
        emit PublicStartUpdated(timestamp);
    }

    // ── schedule / execute: merkle root ─────────────────────────────────
    function scheduleWhitelistMerkleRoot(bytes32 root) external onlyOwner {
        _schedule(_opId(OP_MERKLE, root));
    }

    function executeWhitelistMerkleRoot(bytes32 root) external onlyOwner {
        _consume(_opId(OP_MERKLE, root));
        whitelistMerkleRoot = root;
        emit WhitelistMerkleRootUpdated(root);
    }

    // ── schedule / execute: randomness provider ─────────────────────────
    function scheduleRandomnessProvider(address provider) external onlyOwner {
        if (provider == address(0)) revert ZeroAddress();
        _schedule(_opId(OP_PROVIDER, bytes32(uint256(uint160(provider)))));
    }

    function executeRandomnessProvider(address provider) external onlyOwner {
        if (provider == address(0)) revert ZeroAddress();
        _consume(_opId(OP_PROVIDER, bytes32(uint256(uint160(provider)))));
        randomnessProvider = provider;
        emit RandomnessProviderUpdated(provider);
    }

    // ── schedule / execute: placeholder URI ─────────────────────────────
    function schedulePlaceholderURI(string calldata uri) external onlyOwner {
        if (metadataFrozen) revert MetadataIsFrozen();
        _schedule(_opId(OP_PLACEHOLDER, keccak256(bytes(uri))));
    }

    function executePlaceholderURI(string calldata uri) external onlyOwner {
        if (metadataFrozen) revert MetadataIsFrozen();
        _consume(_opId(OP_PLACEHOLDER, keccak256(bytes(uri))));
        _placeholderURI = uri;
        emit PlaceholderURIUpdated(uri);
    }

    // ── schedule / execute: withdraw ────────────────────────────────────
    function scheduleWithdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _schedule(keccak256(abi.encode(OP_WITHDRAW, to, amount)));
    }

    function executeWithdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        _consume(keccak256(abi.encode(OP_WITHDRAW, to, amount)));
        if (amount > address(this).balance) revert InvalidConfig();
        (bool ok,) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit Withdrawn(to, amount);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Immediate admin (gated)
    // ═══════════════════════════════════════════════════════════════════

    function setSaleIdentityCommitment(bytes32 commitment) external onlyOwner {
        if (saleIdentityCommitmentLocked) revert CommitmentLocked();
        if (collectionRevealed) revert AlreadyRevealed();
        if (commitment == bytes32(0)) revert InvalidConfig();
        saleIdentityCommitment = commitment;
        emit SaleIdentityCommitmentUpdated(commitment);
    }

    function lockSaleIdentityCommitment() external onlyOwner {
        if (saleIdentityCommitment == bytes32(0)) revert SaleNotConfigured();
        if (saleIdentityCommitmentLocked) revert CommitmentLocked();
        saleIdentityCommitmentLocked = true;
        emit SaleIdentityCommitmentLocked(saleIdentityCommitment);
    }

    /// @notice Final metadata base URI — must be set before requestReveal; auto-frozen on reveal completion.
    function setBaseURI(string calldata uri) external onlyOwner {
        if (metadataFrozen) revert MetadataIsFrozen();
        if (revealRequested) revert RevealAlreadyRequested();
        _baseTokenURI = uri;
        emit BaseURIUpdated(uri);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Phase helpers
    // ═══════════════════════════════════════════════════════════════════

    function whitelistStart() public view returns (uint256) {
        if (publicStart == 0) return 0;
        return publicStart - HansomeTypes.WL_EARLY_SECONDS;
    }

    function isWhitelistOpen() public view returns (bool) {
        uint256 start = whitelistStart();
        return start != 0 && block.timestamp >= start && block.timestamp < publicStart;
    }

    function isPublicOpen() public view returns (bool) {
        return publicStart != 0 && block.timestamp >= publicStart && !collectionRevealed && !revealRequested;
    }

    function saleMinted() public view returns (uint256) {
        return nextSaleTokenId - HansomeTypes.FIRST_SALE_ID;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Mint — Reserved
    // ═══════════════════════════════════════════════════════════════════

    function reserveMint(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (reservedMinted) revert ReservedAlreadyMinted();

        reservedMinted = true;

        _mintReserved(to, 1, HansomeTypes.GameplayClass.King);
        _mintReserved(to, 2, HansomeTypes.GameplayClass.Guardian);
        _mintReserved(to, 3, HansomeTypes.GameplayClass.Guardian);
        _mintReserved(to, 4, HansomeTypes.GameplayClass.Farmer);
        _mintReserved(to, 5, HansomeTypes.GameplayClass.Farmer);
        _mintReserved(to, 6, HansomeTypes.GameplayClass.Lucky);
        _mintReserved(to, 7, HansomeTypes.GameplayClass.Lucky);
        _mintReserved(to, 8, HansomeTypes.GameplayClass.Runner);
        _mintReserved(to, 9, HansomeTypes.GameplayClass.Runner);
        _mintReserved(to, 10, HansomeTypes.GameplayClass.Runner);

        emit ReservedMinted(to);
    }

    function _mintReserved(address to, uint256 tokenId, HansomeTypes.GameplayClass cls) private {
        _side[tokenId] = HansomeTypes.Side.Alpaca;
        _gameplayClass[tokenId] = cls;
        _safeMint(to, tokenId);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Mint — Whitelist / Public
    // ═══════════════════════════════════════════════════════════════════

    function whitelistMint(bytes32[] calldata proof) external payable nonReentrant {
        if (!reservedMinted) revert ReservedNotMinted();
        if (!saleIdentityCommitmentLocked) revert CommitmentNotLocked();
        if (!isWhitelistOpen()) {
            if (publicStart != 0 && block.timestamp >= publicStart) revert WhitelistClosed();
            revert WhitelistNotOpen();
        }
        if (whitelistMintCount[msg.sender] >= HansomeTypes.WL_WALLET_MAX) revert ExceedsWalletCap();
        if (whitelistMinted >= HansomeTypes.WHITELIST_CAP) revert ExceedsPhaseCap();
        if (msg.value != mintPrice) revert IncorrectPayment();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
        if (!MerkleProof.verify(proof, whitelistMerkleRoot, leaf)) revert InvalidProof();

        whitelistMintCount[msg.sender] += 1;
        whitelistMinted += 1;
        _mintSaleToken(msg.sender, true);
    }

    function publicMint(uint256 quantity) external payable nonReentrant {
        if (!reservedMinted) revert ReservedNotMinted();
        if (!saleIdentityCommitmentLocked) revert CommitmentNotLocked();
        if (!isPublicOpen()) revert PublicNotOpen();
        if (quantity == 0 || quantity > HansomeTypes.PUBLIC_WALLET_MAX) revert ExceedsWalletCap();
        if (publicMintCount[msg.sender] + quantity > HansomeTypes.PUBLIC_WALLET_MAX) revert ExceedsWalletCap();
        if (whitelistMintCount[msg.sender] + publicMintCount[msg.sender] + quantity > HansomeTypes.COMBINED_WALLET_MAX) {
            revert ExceedsWalletCap();
        }
        if (publicMinted + quantity > HansomeTypes.PUBLIC_CAP) revert ExceedsPhaseCap();
        if (msg.value != mintPrice * quantity) revert IncorrectPayment();

        publicMintCount[msg.sender] += quantity;
        publicMinted += quantity;
        for (uint256 i = 0; i < quantity; i++) {
            _mintSaleToken(msg.sender, false);
        }
    }

    function _mintSaleToken(address to, bool whitelist) private {
        uint256 tokenId = nextSaleTokenId;
        if (tokenId > HansomeTypes.LAST_TOKEN_ID) revert ExceedsSupply();
        nextSaleTokenId = tokenId + 1;
        _safeMint(to, tokenId);
        emit SaleMinted(to, tokenId, whitelist);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Reveal
    // ═══════════════════════════════════════════════════════════════════

    function requestReveal(bytes calldata packedIdentities) external onlyOwner {
        if (collectionRevealed) revert AlreadyRevealed();
        if (revealRequested) revert RevealAlreadyRequested();
        if (!reservedMinted) revert ReservedNotMinted();
        if (!saleIdentityCommitmentLocked) revert CommitmentNotLocked();
        if (bytes(_baseTokenURI).length == 0) revert BaseURIRequired();
        if (saleMinted() != HansomeTypes.SALE_CAP) revert SaleIncomplete();
        if (packedIdentities.length != HansomeTypes.SALE_CAP) revert BadIdentityLength();
        if (keccak256(packedIdentities) != saleIdentityCommitment) revert BadIdentityCommitment();
        _validateSaleComposition(packedIdentities);

        _pendingSaleIdentities = packedIdentities;
        revealRequested = true;
        revealRequestId += 1;

        emit RevealRequested(revealRequestId, saleIdentityCommitment);

        IRevealRandomness(randomnessProvider).requestRandomWord(address(this), revealRequestId);
    }

    /// @inheritdoc IRevealRandomnessReceiver
    /// @dev Only `randomnessProvider` (VRF adapter). Owner cannot fulfill — prevents grinding.
    function fulfillRevealRandomWord(uint256 requestId, uint256 randomWord) external override nonReentrant {
        if (msg.sender != randomnessProvider) revert UnauthorizedRandomness();
        if (!revealRequested || collectionRevealed || revealEntropyReady) revert RevealNotReady();
        if (requestId != revealRequestId) revert RevealNotReady();
        if (_pendingSaleIdentities.length != HansomeTypes.SALE_CAP) revert RevealNotReady();

        _revealRandomWord = randomWord;
        revealEntropyReady = true;
        revealCursor = 0;
        _fyRemaining = 0;
        emit RevealEntropyReady(requestId);
    }

    /**
     * @notice Permissionless batched assignment. Views stay opaque until the final batch.
     */
    function processReveal(uint256 batchSize) external nonReentrant {
        if (!revealEntropyReady || collectionRevealed) revert RevealNotReady();
        if (batchSize == 0) revert InvalidConfig();
        if (_pendingSaleIdentities.length != HansomeTypes.SALE_CAP) revert RevealNotReady();

        if (_fyRemaining == 0 && revealCursor == 0) {
            _fyRemaining = HansomeTypes.SALE_CAP;
        }

        uint256 end = revealCursor + batchSize;
        if (end > HansomeTypes.SALE_CAP) end = HansomeTypes.SALE_CAP;

        bytes memory identities = _pendingSaleIdentities;
        uint256 seed = _revealRandomWord;
        for (uint256 t = revealCursor; t < end; t++) {
            uint256 identityIndex = _fyTake(seed, t);
            uint256 tokenId = HansomeTypes.FIRST_SALE_ID + t;
            uint8 packed = uint8(identities[identityIndex]);
            (HansomeTypes.Side s, HansomeTypes.GameplayClass c) = _unpackIdentity(packed);
            _side[tokenId] = s;
            _gameplayClass[tokenId] = c;
        }

        revealCursor = end;
        emit RevealProgress(revealCursor, HansomeTypes.SALE_CAP);

        if (revealCursor == HansomeTypes.SALE_CAP) {
            collectionRevealed = true;
            delete _pendingSaleIdentities;
            metadataFrozen = true;
            emit MetadataFrozen(_baseTokenURI);
            emit CollectionRevealed(saleIdentityCommitment);
        }
    }

    /// @notice Seed is hidden until the collection is fully revealed (anti-prediction).
    function revealRandomWord() external view returns (uint256) {
        if (!collectionRevealed) revert RevealSeedHidden();
        return _revealRandomWord;
    }

    function _fyTake(uint256 seed, uint256 salt) private returns (uint256 chosen) {
        uint256 n = _fyRemaining;
        if (n == 0) revert RevealNotReady();
        uint256 j = uint256(keccak256(abi.encodePacked(seed, salt))) % n;
        uint256 rawJ = _fy[j];
        chosen = rawJ == 0 ? j : rawJ - 1;

        uint256 last = n - 1;
        uint256 rawLast = _fy[last];
        uint256 lastVal = rawLast == 0 ? last : rawLast - 1;
        _fy[j] = lastVal + 1;
        _fyRemaining = last;
    }

    function _unpackIdentity(uint8 packed)
        private
        pure
        returns (HansomeTypes.Side s, HansomeTypes.GameplayClass c)
    {
        bool isCougar = (packed & 0x80) != 0;
        uint8 cls = packed & 0x0f;
        if (isCougar) {
            if (cls != uint8(HansomeTypes.GameplayClass.None)) revert BadIdentityComposition();
            return (HansomeTypes.Side.Cougar, HansomeTypes.GameplayClass.None);
        }
        if (cls == uint8(HansomeTypes.GameplayClass.None) || cls == uint8(HansomeTypes.GameplayClass.King)) {
            revert BadIdentityComposition();
        }
        if (cls > uint8(HansomeTypes.GameplayClass.Runner)) revert BadIdentityComposition();
        return (HansomeTypes.Side.Alpaca, HansomeTypes.GameplayClass(cls));
    }

    function _validateSaleComposition(bytes calldata packed) private pure {
        uint256 cougars;
        uint256 common;
        uint256 guardian;
        uint256 farmer;
        uint256 lucky;
        uint256 runner;

        for (uint256 i = 0; i < HansomeTypes.SALE_CAP; i++) {
            uint8 packedByte = uint8(packed[i]);
            bool isCougar = (packedByte & 0x80) != 0;
            uint8 cls = packedByte & 0x0f;
            if (isCougar) {
                if (cls != 0) revert BadIdentityComposition();
                cougars++;
            } else {
                if (cls == uint8(HansomeTypes.GameplayClass.Common)) common++;
                else if (cls == uint8(HansomeTypes.GameplayClass.Guardian)) guardian++;
                else if (cls == uint8(HansomeTypes.GameplayClass.Farmer)) farmer++;
                else if (cls == uint8(HansomeTypes.GameplayClass.Lucky)) lucky++;
                else if (cls == uint8(HansomeTypes.GameplayClass.Runner)) runner++;
                else revert BadIdentityComposition();
            }
        }

        if (cougars != 50 || common != 479 || guardian != 3 || farmer != 3 || lucky != 3 || runner != 2) {
            revert BadIdentityComposition();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Views — game API (sale side/class opaque until collection revealed)
    // ═══════════════════════════════════════════════════════════════════

    function side(uint256 tokenId) external view override returns (HansomeTypes.Side) {
        _requireOwned(tokenId);
        if (tokenId <= HansomeTypes.RESERVED_COUNT) return _side[tokenId];
        if (!collectionRevealed) return HansomeTypes.Side.None;
        return _side[tokenId];
    }

    function gameplayClass(uint256 tokenId) external view override returns (HansomeTypes.GameplayClass) {
        _requireOwned(tokenId);
        if (tokenId <= HansomeTypes.RESERVED_COUNT) return _gameplayClass[tokenId];
        if (!collectionRevealed) return HansomeTypes.GameplayClass.None;
        return _gameplayClass[tokenId];
    }

    function isRevealed(uint256 tokenId) external view override returns (bool) {
        _requireOwned(tokenId);
        if (tokenId <= HansomeTypes.RESERVED_COUNT) return true;
        return collectionRevealed;
    }

    function isCollectionRevealed() external view override returns (bool) {
        return collectionRevealed;
    }

    function totalMinted() public view returns (uint256) {
        uint256 reserved = reservedMinted ? HansomeTypes.RESERVED_COUNT : 0;
        return reserved + saleMinted();
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        if (!collectionRevealed || bytes(_baseTokenURI).length == 0) {
            return _placeholderURI;
        }
        return string.concat(_baseTokenURI, tokenId.toString(), ".json");
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
