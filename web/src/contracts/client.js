// 8단계: 블록체인 읽기 · 쓰기 (docs/화면연결설계.md 2절)
// 읽기 = 공개 노드(지갑 없어도 됨), 쓰기 = MetaMask 서명 (개인키는 지갑 밖으로 나오지 않음)
import { BrowserProvider, Contract, JsonRpcProvider, ZeroAddress } from "ethers";
import { DEPLOY_BLOCK, FAIR_REVIEW_ABI, FAIR_REVIEW_ADDRESS, PUBLIC_RPC, SEPOLIA_CHAIN_NUMBER } from "./fairReview.js";

const LOG_CHUNK = 40_000; // 공개 노드가 한 번에 주는 블록 범위 제한을 넘지 않게 나눠서 찾는다

let readOnly = null;
function readContract() {
  if (!readOnly) {
    const provider = new JsonRpcProvider(PUBLIC_RPC, SEPOLIA_CHAIN_NUMBER, { staticNetwork: true });
    readOnly = new Contract(FAIR_REVIEW_ADDRESS, FAIR_REVIEW_ABI, provider);
  }
  return readOnly;
}

/** 포인트 (숫자) */
export async function fetchPoints(account) {
  return Number(await readContract().points(account));
}

/** 결제 기록. 없으면 null */
export async function fetchPayment(paymentId) {
  const p = await readContract().payments(paymentId);
  if (p.customer === ZeroAddress) return null;
  return { storeId: Number(p.storeId), customer: p.customer, reviewed: p.reviewed, paidAt: Number(p.paidAt) };
}

/** 가게에 블록체인으로 제출된 리뷰 (ReviewSubmitted 이벤트), 최신순 */
export async function fetchStoreReviews(storeId) {
  const contract = readContract();
  const latest = await contract.runner.provider.getBlockNumber();
  const filter = contract.filters.ReviewSubmitted(null, storeId);
  const logs = [];
  for (let from = DEPLOY_BLOCK; from <= latest; from += LOG_CHUNK) {
    const to = Math.min(from + LOG_CHUNK - 1, latest);
    logs.push(...(await contract.queryFilter(filter, from, to)));
  }
  return logs
    .map((log) => ({
      paymentId: Number(log.args.paymentId),
      reviewer: log.args.reviewer,
      rating: Number(log.args.rating),
      content: log.args.content,
      txHash: log.transactionHash,
    }))
    .reverse();
}

/** 리뷰 제출 — MetaMask 가 서명 창을 띄운다. 보낸 트랜잭션(tx)을 돌려주고, 기다리기는 화면이 한다 */
export async function sendReview(ethereum, { paymentId, rating, content }) {
  const signer = await new BrowserProvider(ethereum).getSigner();
  const contract = new Contract(FAIR_REVIEW_ADDRESS, FAIR_REVIEW_ABI, signer);
  return contract.submitReview(paymentId, rating, content);
}
