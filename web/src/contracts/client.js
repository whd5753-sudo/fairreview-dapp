// 블록체인 · 오라클 읽기 · 쓰기 (docs/화면연결설계.md 2절, docs/오라클설계.md)
// 읽기 = 공개 노드(지갑 없어도 됨), 쓰기 = MetaMask 서명 (개인키는 지갑 밖으로 나오지 않음)
// 10단계: 리뷰 제출 전에 AI 오라클 서버에서 점수 · 서명을 받는다
import { BrowserProvider, Contract, JsonRpcProvider, ZeroAddress } from "ethers";
import {
  DEPLOY_BLOCK,
  FAIR_REVIEW_ABI,
  FAIR_REVIEW_ADDRESS,
  ORACLE_URL,
  PUBLIC_RPC,
  SEPOLIA_CHAIN_NUMBER,
} from "./fairReview.js";

const LOG_CHUNK = 40_000; // 공개 노드가 한 번에 주는 블록 범위 제한을 넘지 않게 나눠서 찾는다

let readOnly = null;
function readContract() {
  if (!readOnly) {
    const provider = new JsonRpcProvider(PUBLIC_RPC, SEPOLIA_CHAIN_NUMBER, { staticNetwork: true });
    readOnly = new Contract(FAIR_REVIEW_ADDRESS, FAIR_REVIEW_ABI, provider);
  }
  return readOnly;
}

function writeContract(ethereum) {
  return new BrowserProvider(ethereum).getSigner().then((signer) => new Contract(FAIR_REVIEW_ADDRESS, FAIR_REVIEW_ABI, signer));
}

/** 이벤트를 배포 블록부터 나눠서 모두 읽는다 */
async function queryAll(filter) {
  const contract = readContract();
  const latest = await contract.runner.provider.getBlockNumber();
  const logs = [];
  for (let from = DEPLOY_BLOCK; from <= latest; from += LOG_CHUNK) {
    const to = Math.min(from + LOG_CHUNK - 1, latest);
    logs.push(...(await contract.queryFilter(filter, from, to)));
  }
  return logs;
}

function toReview(log, extra = {}) {
  return {
    paymentId: Number(log.args.paymentId),
    storeId: Number(log.args.storeId),
    reviewer: log.args.reviewer,
    rating: Number(log.args.rating),
    content: log.args.content,
    aiScore: Number(log.args.aiScore),
    txHash: log.transactionHash,
    ...extra,
  };
}

/** 포인트 (숫자) */
export async function fetchPoints(account) {
  return Number(await readContract().points(account));
}

/** 관리자 주소 */
export async function fetchAdmin() {
  return readContract().admin();
}

/** 결제 기록. 없으면 null */
export async function fetchPayment(paymentId) {
  const p = await readContract().payments(paymentId);
  if (p.customer === ZeroAddress) return null;
  return { storeId: Number(p.storeId), customer: p.customer, reviewed: p.reviewed, paidAt: Number(p.paidAt) };
}

/** 가게의 게시된 리뷰 (바로 게시 + 보류 후 승인), 최신순 */
export async function fetchStoreReviews(storeId) {
  const contract = readContract();
  const [published, held, resolved] = await Promise.all([
    queryAll(contract.filters.ReviewSubmitted(null, storeId)),
    queryAll(contract.filters.ReviewHeld(null, storeId)),
    queryAll(contract.filters.HeldReviewResolved(null, storeId)),
  ]);
  const approved = new Set(resolved.filter((l) => l.args.approved).map((l) => Number(l.args.paymentId)));
  return [
    ...published.map((l) => toReview(l)),
    ...held.filter((l) => approved.has(Number(l.args.paymentId))).map((l) => toReview(l, { afterReview: true })),
  ].sort((a, b) => b.paymentId - a.paymentId);
}

/** 관리자 검토를 기다리는 보류 리뷰 (모든 가게) */
export async function fetchHeldReviews() {
  const contract = readContract();
  const [held, resolved] = await Promise.all([
    queryAll(contract.filters.ReviewHeld()),
    queryAll(contract.filters.HeldReviewResolved()),
  ]);
  const done = new Set(resolved.map((l) => Number(l.args.paymentId)));
  return held.filter((l) => !done.has(Number(l.args.paymentId))).map((l) => toReview(l));
}

/**
 * 10단계: AI 오라클 서버에 판정 · 서명을 받는다.
 * 돌려주는 값: { score, verdict, reasons, signature, oracle }
 */
export async function requestVerdict({ paymentId, reviewer, rating, content }) {
  let response;
  try {
    response = await fetch(`${ORACLE_URL}/sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentId, reviewer, rating, content }),
    });
  } catch {
    throw "OracleUnavailable"; // 서버가 꺼져 있거나 막힘 (errors.js 의 이름)
  }
  if (!response.ok) throw "OracleRejected";
  return response.json();
}

/** 리뷰 제출 — MetaMask 가 서명 창을 띄운다. 보낸 트랜잭션(tx)을 돌려주고, 기다리기는 화면이 한다 */
export async function sendReview(ethereum, { paymentId, rating, content, score, signature }) {
  const contract = await writeContract(ethereum);
  return contract.submitReview(paymentId, rating, content, score, signature);
}

/** 보류 리뷰 승인(true) · 거절(false) — 관리자 MetaMask 서명 */
export async function sendResolveHeld(ethereum, paymentId, approve) {
  const contract = await writeContract(ethereum);
  return contract.resolveHeld(paymentId, approve);
}
