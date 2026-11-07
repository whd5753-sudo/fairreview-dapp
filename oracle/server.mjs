// 10단계: AI 오라클 서버 — POST /sign 으로 리뷰를 받아 AI 판정 점수에 서명해 돌려준다.
// 실행: oracle 폴더에서  npm start   (먼저 npm run keygen 으로 oracle/.env 를 만든다)
// 개인키는 oracle/.env 에만 있다 (.gitignore 로 커밋 안 됨, Claude 는 읽지 못하게 settings.json 에서 막음).
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { Wallet, getAddress } from "ethers";
import { BadRequest, judge } from "./judge.mjs";

const ENV = new URL("./.env", import.meta.url);
if (existsSync(ENV)) process.loadEnvFile(ENV); // Node 20.12+ 내장 (.env 읽기)

const { ORACLE_PRIVATE_KEY, ORACLE_CONTRACT } = process.env;
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 11155111); // Sepolia
const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED_ORIGINS = ["http://localhost:5173", "https://whd5753-sudo.github.io"];
const MAX_BODY = 4096;

if (!ORACLE_PRIVATE_KEY) {
  console.error("oracle/.env 에 ORACLE_PRIVATE_KEY 가 없습니다. 먼저  npm run keygen");
  process.exit(1);
}
if (!ORACLE_CONTRACT) {
  console.error("oracle/.env 에 ORACLE_CONTRACT (10단계 컨트랙트 주소) 를 적어 주세요");
  process.exit(1);
}
if (![11155111, 31337].includes(CHAIN_ID)) {
  console.error("CHAIN_ID 는 Sepolia(11155111) 또는 로컬 Hardhat(31337) 만 허용합니다");
  process.exit(1);
}

const wallet = new Wallet(ORACLE_PRIVATE_KEY);
const config = { chainId: CHAIN_ID, contract: getAddress(ORACLE_CONTRACT) };

function send(res, status, body, origin) {
  const headers = { "content-type": "application/json; charset=utf-8" };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-headers"] = "content-type";
    headers["access-control-allow-methods"] = "POST, GET, OPTIONS";
    // 배포된 https 사이트가 내 컴퓨터(localhost)의 서버를 부를 때 브라우저가 묻는 허락 (Private Network Access)
    headers["access-control-allow-private-network"] = "true";
  }
  res.writeHead(status, headers);
  res.end(body === null ? "" : JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  // 브라우저에서 온 요청은 우리 화면(localhost:5173 · GitHub Pages)만 받는다
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return send(res, 403, { error: "허용되지 않은 사이트" }, origin);
  if (req.method === "OPTIONS") return send(res, 204, null, origin);
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true, oracle: wallet.address, ...config }, origin);
  }
  if (req.method !== "POST" || req.url !== "/sign") return send(res, 404, { error: "없는 주소" }, origin);

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) return send(res, 413, { error: "요청이 너무 큽니다" }, origin);
  }
  try {
    const result = await judge(wallet, config, JSON.parse(raw));
    console.log(`[서명] 결제 ${result.paymentId} · 점수 ${result.score} · ${result.verdict}`);
    send(res, 200, result, origin);
  } catch (e) {
    const status = e instanceof BadRequest || e instanceof SyntaxError ? 400 : 500;
    const message = e instanceof SyntaxError ? "JSON 형식이 아닙니다" : e.message;
    send(res, status, { error: status === 400 ? message : "오라클 내부 오류" }, origin);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`AI 오라클 서버: http://localhost:${PORT}  (오라클 주소 ${wallet.address}, 체인 ${CHAIN_ID}, 컨트랙트 ${config.contract})`);
});
