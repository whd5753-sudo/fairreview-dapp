// 10단계: 오라클의 판정 — 4단계 AI 엔진(web/src/ai/engine.js)을 그대로 쓰고, 결과에 서명한다.
// 화면과 오라클이 같은 엔진을 쓰므로, 화면의 미리 보기와 오라클의 판정이 같다.
import { getAddress, isAddress } from "ethers";
import { analyzeText, decide } from "../web/src/ai/engine.js";
import { signVerdict } from "./sign.mjs";

export class BadRequest extends Error {}

/** 요청 검사 → AI 판정 → 서명. 결제가 진짜 이 손님 것인지는 컨트랙트가 확인한다 (오라클은 내용만 판정) */
export async function judge(wallet, { chainId, contract }, body) {
  const paymentId = Number(body?.paymentId);
  const rating = Number(body?.rating);
  const content = body?.content;
  if (!Number.isInteger(paymentId) || paymentId < 1) throw new BadRequest("paymentId 는 1 이상의 정수");
  if (!isAddress(body?.reviewer ?? "")) throw new BadRequest("reviewer 는 지갑 주소");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequest("rating 은 1~5");
  if (typeof content !== "string" || content.trim() === "") throw new BadRequest("content 가 비어 있음");
  if (Buffer.byteLength(content, "utf8") > 900) throw new BadRequest("content 는 900바이트까지");

  const { score, reasons } = analyzeText(content, rating);
  const verdict = decide(score);
  const reviewer = getAddress(body.reviewer);
  const signature = await signVerdict(wallet, { chainId, contract, paymentId, reviewer, rating, content, score });
  return { paymentId, reviewer, rating, score, verdict, reasons, signature, oracle: wallet.address };
}
