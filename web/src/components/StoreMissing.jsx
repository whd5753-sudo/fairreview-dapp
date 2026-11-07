import { Link } from "react-router";

// 주소 모양은 맞지만 그 id 의 가게 데이터가 없을 때 (404 화면과 다르다)
export default function StoreMissing() {
  return (
    <section className="card">
      <h2>없는 가게입니다</h2>
      <p>주소의 가게 번호를 확인해 주세요.</p>
      <Link to="/stores">가게 목록으로</Link>
    </section>
  );
}
