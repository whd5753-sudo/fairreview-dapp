import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: GitHub Pages 주소가 https://<계정>.github.io/fairreview-dapp/ 이므로 하위 폴더를 지정
export default defineConfig({
  plugins: [react()],
  base: "/fairreview-dapp/",
});
