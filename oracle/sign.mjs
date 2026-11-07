// 10단계: AI 판정 서명 — 오라클 서버와 테스트가 함께 쓴다.
// 컨트랙트 FairReview.verdictDigest 와 "같은 순서 · 같은 타입"으로 묶어야 서명 확인이 통과한다.
import { AbiCoder, getBytes, id, keccak256, toUtf8Bytes } from "ethers";

export const VERDICT_TAG = id("FairReview.AIVerdict.v1"); // = keccak256("FairReview.AIVerdict.v1")

/** 서명할 내용의 해시 (컨트랙트의 verdictDigest 와 같다) */
export function verdictDigest({ chainId, contract, paymentId, reviewer, rating, content, score }) {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "address", "uint256", "address", "uint8", "bytes32", "uint16"],
      [VERDICT_TAG, chainId, contract, paymentId, reviewer, rating, keccak256(toUtf8Bytes(content)), score],
    ),
  );
}

/** 오라클 지갑으로 서명 (EIP-191 personal_sign — 컨트랙트는 toEthSignedMessageHash 로 확인) */
export function signVerdict(wallet, fields) {
  return wallet.signMessage(getBytes(verdictDigest(fields)));
}
