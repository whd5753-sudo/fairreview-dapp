// 8단계: Sepolia 에 배포한 FairReview 컨트랙트 정보 (docs/화면연결설계.md 1절)
// 주소는 공개 정보다. 개인키 · 니모닉은 화면 코드에 절대 넣지 않는다.

export const FAIR_REVIEW_ADDRESS = "0xc9B6D213119A75cA023d1181B089D1508259cf91";
export const SEPOLIA_CHAIN_NUMBER = 11155111;
export const DEPLOY_BLOCK = 12081773; // 배포된 블록 — 이 블록부터 이벤트를 찾는다
export const EXPLORER = "https://sepolia.etherscan.io";
// 지갑 없이 읽기만 할 때 쓰는 공개 노드 (쓰기 = 서명은 항상 MetaMask)
export const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

// 화면이 쓰는 함수 · 이벤트 · 오류만 적은 ABI (contracts/contracts/FairReview.sol 과 같아야 한다)
export const FAIR_REVIEW_ABI = [
  "function points(address user) view returns (uint256)",
  "function stores(uint256 storeId) view returns (address owner, string name)",
  "function payments(uint256 paymentId) view returns (uint256 storeId, address customer, uint256 amount, uint64 paidAt, bool reviewed)",
  "function submitReview(uint256 paymentId, uint8 rating, string content)",
  "event ReviewSubmitted(uint256 indexed paymentId, uint256 indexed storeId, address indexed reviewer, uint8 rating, string content)",
  "error ContractPaused()",
  "error PaymentNotFound(uint256 paymentId)",
  "error NotPaymentCustomer(uint256 paymentId)",
  "error AlreadyReviewed(uint256 paymentId)",
  "error ReviewExpired(uint256 paymentId)",
  "error InvalidRating(uint8 rating)",
  "error EmptyContent()",
  "error ContentTooLong()",
];

export const txUrl = (hash) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address) => `${EXPLORER}/address/${address}`;
