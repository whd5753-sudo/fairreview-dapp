// 블록체인 오류 → 손님이 읽을 한국어 문장 (docs/화면연결설계.md 4절)
// 지갑이나 노드가 준 원래 메시지는 그대로 보여 주지 않는다.

export const ERROR_MESSAGES = {
  UserRejected: "MetaMask 에서 요청을 취소했습니다",
  WrongStore: "이 가게의 결제가 아닙니다. 결제 번호를 확인해 주세요",
  ContractPaused: "지금은 리뷰 제출이 잠시 중지되었습니다",
  PaymentNotFound: "없는 결제 번호입니다",
  NotPaymentCustomer: "이 결제를 한 손님의 지갑이 아닙니다",
  AlreadyReviewed: "이미 리뷰를 쓴 결제입니다",
  ReviewExpired: "결제 후 30일이 지나 리뷰를 쓸 수 없습니다",
  InvalidRating: "별점은 1~5 사이여야 합니다",
  EmptyContent: "리뷰 내용이 비어 있습니다",
  ContentTooLong: "리뷰가 너무 깁니다 (한글 약 300자까지)",
  InsufficientFunds: "수수료로 낼 SepoliaETH 가 부족합니다",
};
const FALLBACK = "블록체인 요청이 실패했습니다. 잠시 후 다시 시도해 주세요";

/** 오류에서 이름을 꺼낸다 (컨트랙트 custom error 이름, 또는 위 표의 이름) */
export function errorName(error) {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error.code === "ACTION_REJECTED" || error.code === 4001 || error.info?.error?.code === 4001) return "UserRejected";
  if (error.code === "INSUFFICIENT_FUNDS") return "InsufficientFunds";
  if (error.revert?.name) return error.revert.name; // ethers 6 이 ABI 로 해석해 준 이름
  return null;
}

export function toKoreanError(error) {
  return ERROR_MESSAGES[errorName(error)] ?? FALLBACK;
}
