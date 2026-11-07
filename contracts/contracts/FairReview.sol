// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title FairReview — 7단계 최소판
 * 가게 등록 → 결제 기록 → 결제한 손님만 리뷰 → 넘길 수 없는 포인트
 *
 * 리뷰 한 건이 통과하는 관문 (submitReview 안의 순서 그대로)
 *  ① 결제 기록이 있는가?          PaymentNotFound
 *  ② 그 결제의 손님 본인인가?      NotPaymentCustomer
 *  ③ 이 결제로 이미 쓰지 않았나?   AlreadyReviewed
 *  ④ 결제 후 30일 이내인가?       ReviewExpired
 *  ⑤ 별점 · 내용이 정상인가?       InvalidRating / EmptyContent / ContentTooLong
 * AI 오라클 서명 검사는 10단계에서 이 목록에 추가한다.
 */
contract FairReview {
    // ------------------------------------------------------------ 상수
    uint256 public constant REVIEW_POINTS = 10;          // 리뷰 보상: 별점과 상관없이 항상 같다
    uint256 public constant POINT_RATE_BP = 100;         // 결제 적립률 1% (10000 = 100%)
    uint256 public constant REVIEW_WINDOW = 30 days;     // 결제 후 리뷰를 쓸 수 있는 기간
    uint256 public constant MAX_AMOUNT = 10_000_000;     // 한 번 결제 최대 1천만 원
    uint256 public constant MAX_CONTENT_BYTES = 900;     // 한글 약 300자 (한 글자 = 3바이트)

    // ------------------------------------------------------------ 데이터
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

    address public admin;                       // 가게를 등록하는 관리자 (배포한 사람)
    bool public paused;                         // 비상 중지
    uint256 public storeCount;
    uint256 public paymentCount;
    mapping(uint256 => Store) public stores;
    mapping(uint256 => Payment) public payments;
    mapping(address => uint256) public points;  // 보내기(transfer) 함수가 없다 = 남에게 넘길 수 없다

    // ------------------------------------------------------------ 이벤트 (상태를 바꾸는 함수마다 하나)
    event StoreRegistered(uint256 indexed storeId, address indexed owner, string name);
    event PaymentRecorded(uint256 indexed paymentId, uint256 indexed storeId, address indexed customer, uint256 amount, uint256 pointsEarned);
    event ReviewSubmitted(uint256 indexed paymentId, uint256 indexed storeId, address indexed reviewer, uint8 rating, string content);
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

    constructor() {
        admin = msg.sender;
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
    /// 리뷰 제출: 결제한 손님 본인만, 결제 한 건에 한 번, 30일 안에.
    function submitReview(uint256 paymentId, uint8 rating, string calldata content) external whenNotPaused {
        Payment storage p = payments[paymentId];

        if (p.customer == address(0)) revert PaymentNotFound(paymentId);            // ①
        if (msg.sender != p.customer) revert NotPaymentCustomer(paymentId);         // ②
        if (p.reviewed) revert AlreadyReviewed(paymentId);                          // ③
        if (block.timestamp > p.paidAt + REVIEW_WINDOW) revert ReviewExpired(paymentId); // ④
        if (rating < 1 || rating > 5) revert InvalidRating(rating);                 // ⑤
        if (bytes(content).length == 0) revert EmptyContent();
        if (bytes(content).length > MAX_CONTENT_BYTES) revert ContentTooLong();

        p.reviewed = true;                    // 장부에 먼저 표시한다
        points[msg.sender] += REVIEW_POINTS;  // 별점이 1이든 5든 같은 보상
        emit ReviewSubmitted(paymentId, p.storeId, msg.sender, rating, content);
    }
}
