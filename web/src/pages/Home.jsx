import { Link } from "react-router";

export default function Home() {
  return (
    <section className="card">
      <h2>FairReview 는</h2>
      <ul className="intro">
        <li>결제 기록이 블록체인에 있는 손님만 리뷰를 씁니다.</li>
        <li>AI 가 광고 · 과장 리뷰를 미리 걸러 게시 · 보류 · 거부를 정합니다.</li>
        <li>단골에게는 넘길 수 없는 포인트를 주고, 리뷰 보상은 별점과 상관없이 같습니다.</li>
      </ul>
      <Link to="/stores" className="primary link-button">
        가게 둘러보기
      </Link>
    </section>
  );
}
