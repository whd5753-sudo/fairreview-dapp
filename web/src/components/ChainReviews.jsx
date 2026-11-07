import { useCallback, useEffect, useState } from "react";
import { fetchStoreReviews } from "../contracts/client.js";
import { txUrl } from "../contracts/fairReview.js";
import { shortAddress } from "../state/WalletContext.jsx";

// 8 · 10단계: 블록체인에 게시된 이 가게의 리뷰 (바로 게시 + 보류 후 승인). 지갑 없이도 보인다.
// 로딩 · 오류 · 빈 목록을 각각 보여 준다 (6주차 체크리스트 6번).
export default function ChainReviews({ storeId }) {
  const [state, setState] = useState({ status: "loading", reviews: [] });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true; // 가게가 바뀐 뒤 늦게 온 응답은 버린다
    setState({ status: "loading", reviews: [] });
    fetchStoreReviews(Number(storeId))
      .then((reviews) => active && setState({ status: "ready", reviews }))
      .catch(() => active && setState({ status: "error", reviews: [] }));
    return () => {
      active = false;
    };
  }, [storeId, retry]); // 5주차 · 6주차 체크리스트: 라우트 값(storeId)이 바뀌면 다시 불러온다

  const again = useCallback(() => setRetry((n) => n + 1), []);

  return (
    <section className="card" aria-labelledby="chain-reviews-title">
      <h2 id="chain-reviews-title">블록체인에 기록된 리뷰</h2>
      {state.status === "loading" && <p className="muted">블록체인에서 리뷰를 불러오는 중…</p>}
      {state.status === "error" && (
        <p className="status error">
          블록체인 리뷰를 불러오지 못했습니다.{" "}
          <button type="button" className="link-like" onClick={again}>
            다시 시도
          </button>
        </p>
      )}
      {state.status === "ready" && state.reviews.length === 0 && (
        <p className="muted">아직 블록체인에 기록된 리뷰가 없습니다.</p>
      )}
      {state.status === "ready" && state.reviews.length > 0 && (
        <ul className="review-list">
          {state.reviews.map((review) => (
            <li key={review.txHash}>
              <span className="rating">별점 {review.rating}점</span>
              <p>{review.content}</p>
              <p className="muted small">
                결제 {review.paymentId}번 · AI 점수 {review.aiScore}
                {review.afterReview ? " · 검토 후 게시" : ""} · {shortAddress(review.reviewer)} ·{" "}
                <a href={txUrl(review.txHash)} target="_blank" rel="noreferrer">
                  Etherscan
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
