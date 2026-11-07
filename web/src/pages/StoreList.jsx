import { Link } from "react-router";
import { STORES } from "../data/stores.js";

export default function StoreList() {
  return (
    <section>
      <h2 className="page-title">가게 목록</h2>
      <ul className="store-list">
        {STORES.map((store) => (
          <li key={store.id}>
            <Link to={`/stores/${store.id}`} className="card store-card">
              <strong>{store.name}</strong>
              <span className="muted">
                {store.category} · 리뷰 {store.reviews.length}개
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
