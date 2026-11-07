import { Link } from "react-router";

// 어떤 라우트에도 맞지 않는 주소 (가게 데이터가 없는 것과는 다르다)
export default function NotFound() {
  return (
    <section className="card">
      <h2>페이지를 찾을 수 없습니다</h2>
      <p>주소를 다시 확인해 주세요.</p>
      <Link to="/">홈으로</Link>
    </section>
  );
}
