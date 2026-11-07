import { Link, NavLink, Outlet } from "react-router";
import WalletButton from "./WalletButton.jsx";

// 머리글 · 메뉴 · 바닥글은 여기 한 곳에만 두고, 화면마다 바뀌는 가운데는 <Outlet />
export default function Layout() {
  return (
    <div className="page">
      <header className="header">
        <div className="header-top">
          <Link to="/" className="brand">
            FairReview
          </Link>
          <WalletButton />
        </div>
        <p>결제한 손님만 쓰는 공정한 리뷰</p>
        <nav className="nav" aria-label="주 메뉴">
          {/* end: 홈 메뉴가 모든 주소에서 강조되지 않도록 */}
          <NavLink to="/" end>
            홈
          </NavLink>
          <NavLink to="/stores">가게 목록</NavLink>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <p>FairReview · Sepolia 테스트넷 실습용 · 가게 · 리뷰는 예시 데이터</p>
      </footer>
    </div>
  );
}
