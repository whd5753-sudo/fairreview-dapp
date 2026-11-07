// GitHub Pages 새로고침 404 대책: 빌드 후 dist/index.html 을 dist/404.html 로 복사한다.
// Pages 는 없는 주소(/fairreview-dapp/stores/2)에 404.html 을 주므로, 그 안의 React 앱이 주소를 보고 화면을 그린다.
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const from = dist + "index.html";

if (!existsSync(from)) {
  console.error("dist/index.html 이 없습니다. vite build 가 먼저 성공해야 합니다.");
  process.exit(1);
}
copyFileSync(from, dist + "404.html");
console.log("dist/404.html 생성 완료");
