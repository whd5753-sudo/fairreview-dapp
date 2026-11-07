import { Route, Routes } from "react-router";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import StoreList from "./pages/StoreList.jsx";
import StoreDetail from "./pages/StoreDetail.jsx";
import WriteReview from "./pages/WriteReview.jsx";
import NotFound from "./pages/NotFound.jsx";
import AdminReview from "./pages/AdminReview.jsx";

// 주소 → 화면 표 (docs/라우팅설계.md 1절). 공통 부분은 Layout, 가운데는 Outlet.
// 라우터(BrowserRouter / MemoryRouter)는 바깥(main.jsx / 테스트)에서 감싼다.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="stores" element={<StoreList />} />
        <Route path="stores/:id" element={<StoreDetail />} />
        <Route path="stores/:id/review" element={<WriteReview />} />
        <Route path="admin" element={<AdminReview />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
