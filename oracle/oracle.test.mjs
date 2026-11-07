// 10단계: 오라클 테스트 (node --test) — 서명이 오라클 주소로 복구되는지, 판정이 4단계 엔진과 같은지
import { test } from "node:test";
import assert from "node:assert/strict";
import { Wallet, getBytes, verifyMessage } from "ethers";
import { BadRequest, judge } from "./judge.mjs";
import { verdictDigest } from "./sign.mjs";

const wallet = Wallet.createRandom();
const config = { chainId: 11155111, contract: "0x00000000000000000000000000000000000000AA" };
const reviewer = "0x24fa47419CE55143138B2D615bD426AEe2c7f4d0";
const GOOD = "오늘 점심에 김치찌개 시켰는데 국물이 진하고 고기도 넉넉했어요. 9천원이고 사장님도 친절하셨어요";
const HOLD = "체험단으로 다녀왔어요. 분위기 괜찮았어요";
const REJECT = "체험단으로 무료로 제공받았어요 완전 대박 최고 강추 인생맛집 무조건 가세요";

test("O1 게시 리뷰 — 점수 0 · 게시, 서명이 오라클 주소로 복구된다", async () => {
  const r = await judge(wallet, config, { paymentId: 1, reviewer, rating: 5, content: GOOD });
  assert.equal(r.score, 0);
  assert.equal(r.verdict, "게시");
  const digest = verdictDigest({ ...config, paymentId: 1, reviewer, rating: 5, content: GOOD, score: 0 });
  assert.equal(verifyMessage(getBytes(digest), r.signature), wallet.address);
});

test("O2 기대값 표와 같은 점수 — 보류 550 · 거부 990", async () => {
  assert.equal((await judge(wallet, config, { paymentId: 1, reviewer, rating: 4, content: HOLD })).score, 550);
  const rej = await judge(wallet, config, { paymentId: 1, reviewer, rating: 5, content: REJECT });
  assert.equal(rej.score, 990);
  assert.equal(rej.verdict, "거부");
});

test("O3 내용을 한 글자 바꾸면 같은 서명으로 복구한 주소가 달라진다", async () => {
  const r = await judge(wallet, config, { paymentId: 1, reviewer, rating: 5, content: GOOD });
  const tampered = verdictDigest({ ...config, paymentId: 1, reviewer, rating: 5, content: GOOD + "!", score: 0 });
  assert.notEqual(verifyMessage(getBytes(tampered), r.signature), wallet.address);
});

test("O4 잘못된 요청은 BadRequest", async () => {
  const bad = [
    { paymentId: 0, reviewer, rating: 5, content: GOOD },
    { paymentId: 1, reviewer: "0x1234", rating: 5, content: GOOD },
    { paymentId: 1, reviewer, rating: 6, content: GOOD },
    { paymentId: 1, reviewer, rating: 5, content: "   " },
    { paymentId: 1, reviewer, rating: 5, content: "가".repeat(301) },
  ];
  for (const body of bad) await assert.rejects(judge(wallet, config, body), BadRequest);
});
