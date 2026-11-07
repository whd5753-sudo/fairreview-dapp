// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title FairReview — 10단계 (AI 오라클 서명 검증)
 * 가게 등록 → 결제 기록 → 결제한 손님만 리뷰 → AI 오라클이 서명한 점수로 게시 · 보류 · 거부 → 넘길 수 없는 포인트
 *
 * 리뷰 한 건이 통과하는 관문 (submitReview 안의 순서 그대로)
 *  ① 결제 기록이 있는가?                PaymentNotFound
 *  ② 그 결제의 손님 본인인가?            NotPaymentCustomer
 *  ③ 이 결제로 이미 쓰지 않았나?         AlreadyReviewed
 *  ④ 결제 후 30일 이내인가?             ReviewExpired
 *  ⑤ 별점 · 내용 · 점수가 정상인가?       InvalidRating / EmptyContent / ContentTooLong / InvalidScore
 *  ⑥ AI 오라클이 서명한 점수인가?         InvalidOracleSignature   (내용 · 별점 · 점수를 한 글자라도 바꾸면 여기서 걸림)
 *  ⑦ 점수가 거부 기준(700) 미만인가?     SuspectedFakeReview
 * 통과하면 점수 400 미만 = 게시(+10포인트), 400~699 = 보류(관리자가 승인하면 게시 + 10포인트)
 *
 * 블록체인은 AI 를 돌릴 수 없으므로, 체인 밖 오라클 서버가 AI 판정 점수에 서명하고 컨트랙트는 그 서명만 확인한다.
 * (9단계 보안 점검 T1 — 화면을 거치지 않고 직접 호출해도 AI 판정을 건너뛸 수 없게 한다)
 */
contract FairReview {
    // ------------------------------------------------------------ 상수
    uint256 public constant REVIEW_POINTS = 10;          // 리뷰 보상: 별점과 상관없이 항상 같다
    uint256 public constant POINT_RATE_BP = 100;         // 결제 적립률 1% (10000 = 100%)
    uint256 public constant REVIEW_WINDOW = 30 days;     // 결제 후 리뷰를 쓸 수 있는 기간
    uint256 public constant MAX_AMOUNT = 10_000_000;     // 한 번 결제 최대 1천만 원
    uint256 public constant MAX_CONTENT_BYTES = 900;     // 한글 약 300자 (한 글자 = 3바이트)
    uint16 public constant MAX_SCORE = 1000;             // AI 점수 범위 0~1000 (4단계 엔진과 같음)
    uint16 public constant HOLD_SCORE = 400;             // 400 이상 = 보류
    uint16 public constant REJECT_SCORE = 700;           // 700 이상 = 거부
    bytes32 public constant VERDICT_TAG = keccak256("FairReview.AIVerdict.v1"); // 서명 용도 표시 (다른 서명과 섞이지 않게)

    // ------------------------------------------------------------ 데이터
    enum ReviewStatus { None, Published, Held, Rejected } // 없음 · 게시 · 보류(검토 대기) · 보류 후 거절

    struct Store {
        address owner;     // 가게 사장님 지갑
        string name;
    }

    struct Payment {
        uint256 storeId;
        address customer;  // 결제한 손님 지갑
        uint256 amount;    // 원 단위 (진짜 돈이 아니라 기록용 숫자)
        uint64 paidAt;     // 결제 시각
        bool reviewed;     // 이 결제로 리뷰를 썼는가
    }

    address public immutable admin;             // 가게 등록 · 보류 검토 · 비상 중지 (배포한 사람)
    address public immutable oracle;            // AI 판정에 서명하는 오라클 서버의 주소 (개인키는 서버에만)
    bool public paused;                         // 비상 중지
    uint256 public storeCount;
    uint256 public paymentCount;
    mapping(uint256 => Store) public stores;
    mapping(uint256 => Payment) public payments;
    mapping(uint256 => ReviewStatus) public reviewStatus; // 결제 번호 → 리뷰 상태
    mapping(address => uint256) public points;  // 보내기(transfer) 함수가 없다 = 남에게 넘길 수 없다

    // ------------------------------------------------------------ 이벤트 (상태를 바꾸는 함수마다 하나)
    event StoreRegistered(uint256 indexed storeId, address indexed owner, string name);
    event PaymentRecorded(uint256 indexed paymentId, uint256 indexed storeId, address indexed customer, uint256 amount, uint256 pointsEarned);
    event ReviewSubmitted(uint256 indexed paymentId, uint256 indexed storeId, address indexed reviewer, uint8 rating, string content, uint16 aiScore);
    event ReviewHeld(uint256 indexed paymentId, uint256 indexed storeId, address indexed reviewer, uint8 rating, string content, uint16 aiScore);
    event HeldReviewResolved(uint256 indexed paymentId, uint256 indexed storeId, bool approved);
    event Paused(address by);
    event Unpaused(address by);

    // ------------------------------------------------------------ 오류 (custom error)
    error NotAdmin();
    error ContractPaused();
    error StoreNotFound(uint256 storeId);
    error NotStoreOwner(uint256 storeId);
    error ZeroAddress();
    error EmptyName();
    error InvalidAmount();
    error SelfPayment();
    error PaymentNotFound(uint256 paymentId);
    error NotPaymentCustomer(uint256 paymentId);
    error AlreadyReviewed(uint256 paymentId);
    error ReviewExpired(uint256 paymentId);
    error InvalidRating(uint8 rating);
    error EmptyContent();
    error ContentTooLong();
    error InvalidScore(uint16 score);
    error InvalidOracleSignature();
    error SuspectedFakeReview(uint16 score);
    error NotHeld(uint256 paymentId);

    // ------------------------------------------------------------ 권한 검사 (modifier)
    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier onlyStoreOwner(uint256 storeId) {
        address owner = stores[storeId].owner;
        if (owner == address(0)) revert StoreNotFound(storeId);
        if (msg.sender != owner) revert NotStoreOwner(storeId);
        _;
    }

    constructor(address oracle_) {
        if (oracle_ == address(0)) revert ZeroAddress();
        admin = msg.sender;
        oracle = oracle_;
    }

    // ------------------------------------------------------------ 관리자
    /// 가게 등록: 관리자만. 사장님 지갑과 가게 이름을 기록한다.
    function registerStore(address owner, string calldata name)
        external
        onlyAdmin
        whenNotPaused
        returns (uint256 storeId)
    {
        if (owner == address(0)) revert ZeroAddress();
        if (bytes(name).length == 0) revert EmptyName();

        storeId = ++storeCount;                 // 1번부터 (0번은 '없음'으로 남겨 둔다)
        stores[storeId] = Store(owner, name);
        emit StoreRegistered(storeId, owner, name);
    }

    /// 보류된 리뷰 검토: 관리자(플랫폼)만. 가게 사장님은 이해관계가 있어 검토하지 않는다.
    function resolveHeld(uint256 paymentId, bool approve) external onlyAdmin whenNotPaused {
        if (reviewStatus[paymentId] != ReviewStatus.Held) revert NotHeld(paymentId);
        Payment storage p = payments[paymentId];

        if (approve) {
            reviewStatus[paymentId] = ReviewStatus.Published;
            points[p.customer] += REVIEW_POINTS; // 승인되면 그때 보상
        } else {
            reviewStatus[paymentId] = ReviewStatus.Rejected;
        }
        emit HeldReviewResolved(paymentId, p.storeId, approve);
    }

    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ------------------------------------------------------------ 가게
    /// 결제 기록: 그 가게 사장님만. 손님에게 결제 금액의 1% 를 포인트로 적립한다.
    function recordPayment(uint256 storeId, address customer, uint256 amount)
        external
        whenNotPaused
        onlyStoreOwner(storeId)
        returns (uint256 paymentId)
    {
        if (customer == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > MAX_AMOUNT) revert InvalidAmount();
        if (customer == msg.sender) revert SelfPayment();   // 사장님이 자기 가게에 셀프 리뷰 금지

        uint256 earned = (amount * POINT_RATE_BP) / 10_000; // 곱한 다음 나눈다

        paymentId = ++paymentCount;
        payments[paymentId] = Payment(storeId, customer, amount, uint64(block.timestamp), false);
        points[customer] += earned;
        emit PaymentRecorded(paymentId, storeId, customer, amount, earned);
    }

    // ------------------------------------------------------------ 손님
    /// 오라클이 서명하는 내용의 해시. 오라클 서버(oracle/sign.mjs)와 같은 순서 · 같은 타입이어야 한다.
    /// 체인 id · 이 컨트랙트 주소 · 리뷰 쓰는 사람 주소가 들어가므로, 다른 체인 · 다른 컨트랙트 · 다른 사람은 이 서명을 쓸 수 없다.
    function verdictDigest(uint256 paymentId, address reviewer, uint8 rating, string calldata content, uint16 score)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(VERDICT_TAG, block.chainid, address(this), paymentId, reviewer, rating, keccak256(bytes(content)), score)
        );
    }

    /// 리뷰 제출: 결제한 손님 본인만, 결제 한 건에 한 번, 30일 안에, AI 오라클이 서명한 점수로.
    function submitReview(uint256 paymentId, uint8 rating, string calldata content, uint16 score, bytes calldata signature)
        external
        whenNotPaused
    {
        Payment storage p = payments[paymentId];

        if (p.customer == address(0)) revert PaymentNotFound(paymentId);            // ①
        if (msg.sender != p.customer) revert NotPaymentCustomer(paymentId);         // ②
        if (p.reviewed) revert AlreadyReviewed(paymentId);                          // ③
        if (block.timestamp > p.paidAt + REVIEW_WINDOW) revert ReviewExpired(paymentId); // ④
        if (rating < 1 || rating > 5) revert InvalidRating(rating);                 // ⑤
        if (bytes(content).length == 0) revert EmptyContent();
        if (bytes(content).length > MAX_CONTENT_BYTES) revert ContentTooLong();
        if (score > MAX_SCORE) revert InvalidScore(score);

        // ⑥ 오라클 서명 확인 (ECDSA.recover 는 잘못된 서명 · 가변 서명을 revert 로 거른다)
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(verdictDigest(paymentId, msg.sender, rating, content, score));
        (address signer, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || signer != oracle) revert InvalidOracleSignature();

        if (score >= REJECT_SCORE) revert SuspectedFakeReview(score);              // ⑦

        p.reviewed = true;                    // 장부에 먼저 표시한다
        if (score >= HOLD_SCORE) {
            reviewStatus[paymentId] = ReviewStatus.Held;  // 보류: 보상은 관리자가 승인할 때
            emit ReviewHeld(paymentId, p.storeId, msg.sender, rating, content, score);
        } else {
            reviewStatus[paymentId] = ReviewStatus.Published;
            points[msg.sender] += REVIEW_POINTS;  // 별점이 1이든 5든 같은 보상
            emit ReviewSubmitted(paymentId, p.storeId, msg.sender, rating, content, score);
        }
    }
}
