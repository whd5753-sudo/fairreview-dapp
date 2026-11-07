// 10단계: 오라클 전용 테스트 지갑 만들기 → oracle/.env 에 저장 (이미 있으면 덮어쓰지 않는다)
// 이 지갑은 서명만 한다. ETH 를 보낼 필요가 없고, MetaMask 지갑과 상관없다. Sepolia · 로컬 전용.
import { existsSync, writeFileSync } from "node:fs";
import { Wallet } from "ethers";

const ENV = new URL("./.env", import.meta.url);
if (existsSync(ENV)) {
  console.log("oracle/.env 가 이미 있습니다. 덮어쓰지 않습니다 (새로 만들려면 파일을 직접 지우세요).");
  process.exit(0);
}
const wallet = Wallet.createRandom();
writeFileSync(
  ENV,
  [
    "# 10단계 AI 오라클 — 테스트 전용. 절대 커밋 · 공유하지 말 것 (.gitignore 에 .env 포함)",
    `ORACLE_PRIVATE_KEY=${wallet.privateKey}`,
    "",
  ].join("\n"),
);
console.log("oracle/.env 를 만들었습니다 (개인키는 화면에 출력하지 않습니다).");
console.log(`오라클 주소: ${wallet.address}`);
console.log("→ 이 주소를 Remix 에서 FairReview 배포할 때 생성자 값(oracle_)으로 넣습니다.");
