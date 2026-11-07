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

// 4단계: web 테스트 (설치가 끝난 뒤부터 검사)
if (existsSync("web/package.json") && existsSync("web/node_modules")) {
  try {
    execSync("npm test", { cwd: "web", stdio: "pipe", timeout: 120000 });
  } catch (e) {
    const out = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
    problems.push("web 테스트 실패 (기대값 표와 다름):\n" + out.slice(-1500));
  }
}

if (problems.length) {
  console.error("[검사 실패]\n- " + problems.join("\n- "));
  process.exit(2);
}
