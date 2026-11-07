// PostToolUse 훅: Claude 가 파일을 고칠 때마다 자동으로 실행되는 검사
// 통과 → 종료 코드 0 (조용히 지나감)
// 실패 → 종료 코드 2 + 이유 출력 (Claude 에게 전달되어 스스로 고치게 함)
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const problems = [];

// 2단계: 프로젝트 규칙 파일
if (!existsSync("README.md")) problems.push("README.md 가 없습니다");
else if (!readFileSync("README.md", "utf8").includes("FairReview"))
  problems.push("README.md 에 프로젝트 이름 'FairReview' 가 없습니다");

if (!existsSync("CLAUDE.md")) problems.push("CLAUDE.md 가 없습니다");
else {
  const rules = readFileSync("CLAUDE.md", "utf8").split("\n").filter((l) => /^\d+\.\s/.test(l));
  if (rules.length < 3) problems.push(`CLAUDE.md 의 규칙이 ${rules.length}개뿐입니다 (3개 이상 필요)`);
}

// 설치가 끝난 폴더만 테스트한다
function runTests(dir, command, label) {
  if (!existsSync(`${dir}/package.json`) || !existsSync(`${dir}/node_modules`)) return;
  try {
    execSync(command, { cwd: dir, stdio: "pipe", timeout: 180000 });
  } catch (e) {
    const out = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
    problems.push(`${label}:\n` + out.slice(-1500));
  }
}

// 4단계: web 테스트 (기대값 표 · 화면)
runTests("web", "npm test", "web 테스트 실패 (기대값 표와 다름)");
// 10단계: 오라클 테스트 (서명 · 판정)
runTests("oracle", "npm test", "오라클 테스트 실패");
// 8 · 10단계: 컨트랙트 테스트 (docs/테스트설계.md) — oracle/sign.mjs 를 쓰므로 oracle 설치가 먼저
if (existsSync("oracle/node_modules")) {
  runTests("contracts", "npx hardhat test", "컨트랙트 테스트 실패 (테스트 설계 표와 다름)");
}

if (problems.length) {
  console.error("[검사 실패]\n- " + problems.join("\n- "));
  process.exit(2);
}
