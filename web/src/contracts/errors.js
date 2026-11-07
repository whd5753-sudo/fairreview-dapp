// 블록체인 · 오라클 오류 → 손님이 읽을 한국어 문장 (docs/화면연결설계.md 4절, 10단계 오라클 추가)
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
  // 10단계: AI 오라클
  OracleUnavailable: "AI 오라클 서버에 연결할 수 없습니다. oracle 폴더에서 npm start 로 서버를 켜 주세요",
  OracleRejected: "AI 오라클이 요청을 받지 않았습니다. 내용과 결제 번호를 확인해 주세요",
  InvalidScore: "AI 점수가 올바르지 않습니다",
  InvalidOracleSignature: "AI 오라클 서명이 맞지 않습니다 (내용이 바뀌었거나 다른 오라클의 서명)",
  SuspectedFakeReview: "AI 판정 거부: 광고 · 과장 리뷰로 보여 블록체인에 기록할 수 없습니다",
  NotHeld: "이미 검토가 끝난 리뷰입니다",
  NotAdmin: "관리자만 할 수 있습니다",
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
