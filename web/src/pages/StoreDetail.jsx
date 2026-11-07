import { Link, useParams } from "react-router";
import { getStore } from "../data/stores.js";
import StoreMissing from "../components/StoreMissing.jsx";
import ChainReviews from "../components/ChainReviews.jsx";

export default function StoreDetail() {
  const { id } = useParams();
  const store = getStore(id);
  if (!store) return <StoreMissing />;

  return (
    <>
      <section className="card">
        <h2>{store.name}</h2>
        <p className="muted">{store.category}</p>
        <h3>메뉴</h3>
        <ul className="menu">
          {store.menu.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <span>{item.price.toLocaleString("ko-KR")}원</span>
            </li>
          ))}
        </ul>
        <Link to={`/stores/${store.id}/review`} className="primary link-button">
          리뷰 쓰기
        </Link>
      </section>

      <ChainReviews storeId={store.id} />

      <section className="card">
        <h2>예시 리뷰</h2>
        <p className="muted small">6단계 화면용 예시 데이터입니다. 실제 기록은 위 "블록체인에 기록된 리뷰"에 있습니다.</p>
        <ul className="review-list">
          {store.reviews.map((review) => (
            <li key={review.content}>
              <span className="rating">별점 {review.rating}점</span>
              <p>{review.content}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
