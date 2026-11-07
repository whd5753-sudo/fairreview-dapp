import { useState } from "react";
import { fetchPayment, sendReview } from "../contracts/client.js";
import { toKoreanError } from "../contracts/errors.js";
import { txUrl } from "../contracts/fairReview.js";
import { getProvider, useWallet } from "../state/WalletContext.jsx";

// 8단계: AI 검사에서 '게시'를 받은 리뷰를 블록체인(FairReview.submitReview)에 제출한다.
// 순서: ① 결제 번호를 공개 노드로 미리 확인 → ② MetaMask 서명 → ③ 블록에 담길 때까지 기다림
// 보류 · 거부 리뷰는 제출하지 않는다 (보류는 10단계 오라클 · 사람 검토에서 다룬다).
export default function ChainSubmit({ store, rating, content, verdict }) {
  const { account, isSepolia, switchToSepolia, refreshPoints } = useWallet();
  const [paymentId, setPaymentId] = useState("");
  const [status, setStatus] = useState("idle"); // idle · checking · signing · mining · done · error
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState(null);

  const busy = status === "checking" || status === "signing" || status === "mining";
  const idNumber = Number(paymentId);
  const validId = Number.isInteger(idNumber) && idNumber >= 1;

  if (verdict === "거부") {
    return (
      <section className="card chain-submit">
        <h2>블록체인에 제출</h2>
        <p className="status error">거부 판정을 받은 리뷰는 블록체인에 올릴 수 없습니다.</p>
      </section>
    );
  }
  if (verdict === "보류") {
    return (
      <section className="card chain-submit">
        <h2>블록체인에 제출</h2>
        <p className="status">보류 판정은 사람 검토가 필요해 지금은 제출할 수 없습니다 (10단계에서 연결).</p>
      </section>
    );
  }

  function fail(errorOrName) {
    setStatus("error");
    setMessage(toKoreanError(errorOrName));
  }

  async function submit() {
    setTxHash(null);
    try {
      // ① 미리 확인 — 수수료를 쓰기 전에 걸러 낼 수 있는 것은 여기서 거른다 (최종 판단은 컨트랙트)
      setStatus("checking");
      setMessage("결제 기록을 확인하는 중…");
      const payment = await fetchPayment(idNumber);
      if (!payment) return fail("PaymentNotFound");
      if (String(payment.storeId) !== store.id) return fail("WrongStore");
      if (payment.customer.toLowerCase() !== account.toLowerCase()) return fail("NotPaymentCustomer");
      if (payment.reviewed) return fail("AlreadyReviewed");

      // ② 서명
      setStatus("signing");
      setMessage("MetaMask 창에서 내용을 확인하고 승인해 주세요");
      const tx = await sendReview(getProvider(), { paymentId: idNumber, rating, content });

      // ③ 기록 대기
      setStatus("mining");
      setTxHash(tx.hash);
      setMessage("블록체인에 기록하는 중… (보통 15초 안팎)");
      await tx.wait();

      setStatus("done");
      setMessage("제출 완료! 리뷰가 블록체인에 기록되었고 10포인트를 받았습니다.");
      refreshPoints();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <section className="card chain-submit" aria-labelledby="chain-title">
      <h2 id="chain-title">블록체인에 제출</h2>

      {!account && <p className="status">지갑을 연결해야 제출할 수 있습니다. 머리글의 '지갑 연결'을 눌러 주세요.</p>}

      {account && !isSepolia && (
        <p className="status">
          Sepolia 네트워크에서만 제출할 수 있습니다.{" "}
          <button type="button" className="link-like" onClick={switchToSepolia}>
            Sepolia 로 전환
          </button>
        </p>
      )}

      {account && isSepolia && (
        <>
          <div className="field">
            <label className="field-label" htmlFor="payment-id">
              결제 번호
            </label>
            <input
              id="payment-id"
              type="number"
              min="1"
              inputMode="numeric"
              value={paymentId}
              disabled={busy || status === "done"}
              onChange={(e) => {
                setPaymentId(e.target.value);
                setStatus("idle");
                setMessage("");
              }}
              placeholder="사장님이 기록한 결제 번호 (예: 1)"
            />
          </div>
          <button
            type="button"
            className="primary"
            disabled={!validId || busy || status === "done"}
            onClick={submit}
          >
            {busy ? "처리 중…" : "블록체인에 제출"}
          </button>
        </>
      )}

      {message && (
        <p className={status === "error" ? "status error" : status === "done" ? "status done" : "status"} role="status">
          {message}
        </p>
      )}
      {txHash && (
        <p className="status">
          <a href={txUrl(txHash)} target="_blank" rel="noreferrer">
            Etherscan 에서 트랜잭션 보기
          </a>
        </p>
      )}
    </section>
  );
}
