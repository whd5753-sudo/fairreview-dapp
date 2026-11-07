// 9단계: 뮤테이션 테스트 — 컨트랙트의 안전 검사를 한 줄씩 일부러 지워 보고, 테스트가 잡아내는지 확인한다.
// 실행: contracts 폴더에서  npm run mutation
// 원본 FairReview.sol 은 끝나면 (실패해도) 반드시 되돌린다.
const { readFileSync, writeFileSync } = require("node:fs");
const { execSync } = require("node:child_process");
const path = require("node:path");

const FILE = path.join(__dirname, "..", "contracts", "FairReview.sol");

// [이름, 지울 줄(정확히 같은 글자)]
const MUTANTS = [
  ["M1 리뷰 중복 검사", "if (p.reviewed) revert AlreadyReviewed(paymentId);"],
  ["M2 리뷰했다고 장부에 표시", "p.reviewed = true;"],
  ["M3 결제한 손님 본인 검사", "if (msg.sender != p.customer) revert NotPaymentCustomer(paymentId);"],
  ["M4 결제 존재 검사", "if (p.customer == address(0)) revert PaymentNotFound(paymentId);"],
  ["M5 30일 기한 검사", "if (block.timestamp > p.paidAt + REVIEW_WINDOW) revert ReviewExpired(paymentId);"],
  ["M6 사장님 권한 검사", "if (msg.sender != owner) revert NotStoreOwner(storeId);"],
  ["M7 셀프 결제 금지", "if (customer == msg.sender) revert SelfPayment();"],
  ["M8 관리자 권한 검사", "if (msg.sender != admin) revert NotAdmin();"],
  ["M9 비상 중지 검사", "if (paused) revert ContractPaused();"],
  ["M10 별점 범위 검사", "if (rating < 1 || rating > 5) revert InvalidRating(rating);"],
  ["M11 금액 범위 검사", "if (amount == 0 || amount > MAX_AMOUNT) revert InvalidAmount();"],
  // 10단계: AI 오라클
  ["M12 오라클 서명 확인", "if (err != ECDSA.RecoverError.NoError || signer != oracle) revert InvalidOracleSignature();"],
  ["M13 거부 점수(700) 차단", "if (score >= REJECT_SCORE) revert SuspectedFakeReview(score);"],
  ["M14 점수 범위 검사", "if (score > MAX_SCORE) revert InvalidScore(score);"],
  ["M15 보류 상태만 검토", "if (reviewStatus[paymentId] != ReviewStatus.Held) revert NotHeld(paymentId);"],
  ["M16 오라클 주소 0 금지", "if (oracle_ == address(0)) revert ZeroAddress();"],
];

const original = readFileSync(FILE, "utf8");
// Ctrl+C 로 중간에 멈춰도 원본을 되돌린다
process.on("SIGINT", () => {
  writeFileSync(FILE, original);
  console.log("\n중단 — FairReview.sol 원본을 되돌렸습니다");
  process.exit(130);
});
const results = [];
try {
  for (const [name, line] of MUTANTS) {
    if (!original.includes(line)) {
      results.push([name, "줄을 못 찾음 (코드가 바뀌었는지 확인)"]);
      continue;
    }
    writeFileSync(FILE, original.replace(line, "// " + line));
    let out = "";
    try {
      out = execSync("npx hardhat test", { cwd: path.join(__dirname, ".."), stdio: "pipe", timeout: 180000 }).toString();
    } catch (e) {
      out = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
    }
    // 실패한 테스트 번호(A1, C4 ...)를 모은다
    const failed = [...out.matchAll(/^\s+\d+\) FairReview[^\n]*\n[^\n]*\n\s+([A-F]\d+)/gm)].map((m) => m[1]);
    results.push([name, failed.length ? `잡힘 ✔ (${[...new Set(failed)].join(", ")})` : "놓침 ✘ — 이 검사를 지켜 주는 테스트가 없음"]);
    console.log(`${name}: ${results.at(-1)[1]}`);
  }
} finally {
  writeFileSync(FILE, original); // 원본 복구
}

const missed = results.filter(([, r]) => !r.startsWith("잡힘")).length;
console.log(`\n결과: ${MUTANTS.length - missed} / ${MUTANTS.length} 잡힘`);
process.exit(missed ? 1 : 0);
