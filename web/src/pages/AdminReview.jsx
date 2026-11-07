import { useCallback, useEffect, useState } from "react";
import { fetchAdmin, fetchHeldReviews, sendResolveHeld } from "../contracts/client.js";
import { toKoreanError } from "../contracts/errors.js";
import { txUrl } from "../contracts/fairReview.js";
import { getProvider, shortAddress, useWallet } from "../state/WalletContext.jsx";
import { STORES } from "../data/stores.js";

// 10단계: 보류 리뷰 검토 (관리자 = 컨트랙트 admin). 가게 사장님은 이해관계가 있어 검토하지 않는다.
// 승인 → 게시 + 손님 10포인트, 거절 → 게시 안 함. 최종 권한 검사는 컨트랙트(onlyAdmin)가 한다.
export default function AdminReview() {
  const { account, isSepolia, switchToSepolia } = useWallet();
  const [admin, setAdmin] = useState(null);
  const [state, setState] = useState({ status: "loading", reviews: [] });
  const [action, setAction] = useState({}); // paymentId → { status, message, txHash }
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading", reviews: [] });
    Promise.all([fetchAdmin(), fetchHeldReviews()])
      .then(([adminAddress, reviews]) => {
        if (!active) return;
        setAdmin(adminAddress);
        setState({ status: "ready", reviews });
      })
      .catch(() => active && setState({ status: "error", reviews: [] }));
    return () => {
      active = false;
    };
  }, [retry]);

  const again = useCallback(() => setRetry((n) => n + 1), []);
  const isAdmin = Boolean(account && admin && account.toLowerCase() === admin.toLowerCase());

  async function resolve(paymentId, approve) {
    setAction((a) => ({ ...a, [paymentId]: { status: "signing", message: "MetaMask 창에서 승인해 주세요" } }));
    try {
      const tx = await sendResolveHeld(getProvider(), paymentId, approve);
      setAction((a) => ({ ...a, [paymentId]: { status: "mining", message: "블록체인에 기록하는 중…", txHash: tx.hash } }));
      await tx.wait();
      setAction((a) => ({
        ...a,
        [paymentId]: { status: "done", message: approve ? "승인했습니다 (게시 + 10포인트)" : "거절했습니다", txHash: tx.hash },
      }));
    } catch (e) {
      setAction((a) => ({ ...a, [paymentId]: { status: "error", message: toKoreanError(e) } }));
    }
  }

  const storeName = (id) => STORES.find((s) => s.id === String(id))?.name ?? `가게 ${id}`;

  return (
    <section className="card" aria-labelledby="admin-title">
      <h2 id="admin-title">보류 리뷰 검토 (관리자)</h2>
      <p className="muted small">AI 점수 400~699 리뷰는 바로 게시되지 않고 여기서 관리자가 승인 · 거절합니다.</p>

      {state.status === "loading" && <p className="muted">블록체인에서 보류 리뷰를 불러오는 중…</p>}
      {state.status === "error" && (
        <p className="status error">
          보류 리뷰를 불러오지 못했습니다.{" "}
          <button type="button" className="link-like" onClick={again}>
            다시 시도
          </button>
        </p>
      )}

      {state.status === "ready" && !isAdmin && (
        <p className="status">관리자 지갑으로 연결해야 검토할 수 있습니다{admin ? ` (관리자 ${shortAddress(admin)})` : ""}.</p>
      )}
      {state.status === "ready" && isAdmin && !isSepolia && (
        <p className="status">
          Sepolia 네트워크에서만 검토할 수 있습니다.{" "}
          <button type="button" className="link-like" onClick={switchToSepolia}>
            Sepolia 로 전환
          </button>
        </p>
      )}

      {state.status === "ready" && state.reviews.length === 0 && <p className="muted">검토를 기다리는 리뷰가 없습니다.</p>}
      {state.status === "ready" && state.reviews.length > 0 && (
        <ul className="review-list">
          {state.reviews.map((review) => {
            const act = action[review.paymentId];
            const locked = act && act.status !== "error";
            return (
              <li key={review.txHash}>
                <span className="rating">
                  {storeName(review.storeId)} · 별점 {review.rating}점 · AI 점수 {review.aiScore}
                </span>
                <p>{review.content}</p>
                <p className="muted small">
                  결제 {review.paymentId}번 · {shortAddress(review.reviewer)} ·{" "}
                  <a href={txUrl(review.txHash)} target="_blank" rel="noreferrer">
                    Etherscan
                  </a>
                </p>
                {isAdmin && isSepolia && (
                  <div className="admin-actions">
                    <button type="button" className="primary" disabled={locked} onClick={() => resolve(review.paymentId, true)}>
                      승인
                    </button>
                    <button type="button" className="wallet-button" disabled={locked} onClick={() => resolve(review.paymentId, false)}>
                      거절
                    </button>
                  </div>
                )}
                {act && (
                  <p className={act.status === "error" ? "status error" : act.status === "done" ? "status done" : "status"} role="status">
                    {act.message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
