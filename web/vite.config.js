import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: GitHub Pages 주소가 https://<계정>.github.io/fairreview-dapp/ 이므로 하위 폴더를 지정
// (main.jsx 의 BrowserRouter basename 이 이 값을 따라간다)
export default defineConfig({
  plugins: [react()],
  base: "/fairreview-dapp/",
  // 6단계: 화면 테스트(React Testing Library)는 브라우저 흉내(jsdom)에서 돌린다
  test: {
    environment: "jsdom",
  },
});
