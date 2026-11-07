// docs/기대값표.md 를 그대로 옮긴 테스트 — 실패하면 표가 아니라 코드를 고친다
import { describe, it, expect } from "vitest";
import { analyzeText, decide, charCount } from "./engine.js";

const rows = [
  { no: 1, content: "오늘 점심에 김치찌개 시켰는데 국물이 진하고 고기도 넉넉했어요. 9천원이고 사장님도 친절하셨어요", rating: 5, len: 43, score: 0, verdict: "게시" },
  { no: 2, content: "맛있어요", rating: 5, len: 4, score: 150, verdict: "게시" },
  { no: 3, content: "체험단으로 무료로 제공받았어요 완전 대박 최고 강추 인생맛집 무조건 가세요", rating: 5, len: 32, score: 900, verdict: "거부" },
  { no: 4, content: "체험단으로 다녀왔어요. 분위기 괜찮았어요", rating: 4, len: 19, score: 550, verdict: "보류" },
  { no: 5, content: "완전 대박 최고 맛집", rating: 5, len: 8, score: 270, verdict: "게시" },
  { no: 6, content: "그냥 그래요", rating: 3, len: 5, score: 100, verdict: "게시" },
  { no: 7, content: "   ", rating: 5, len: 0, score: 150, verdict: "게시" },
  { no: 8, content: "협찬받아 방문했고 김치찌개 9천원, 국물은 진하고 양이 많았어요", rating: 4, len: 28, score: 450, verdict: "보류" },
];

describe("analyzeText — 기대값 표", () => {
  for (const r of rows) {
    it(`#${r.no} 글자 수 ${r.len} · 점수 ${r.score} · ${r.verdict}`, () => {
      expect(charCount(r.content)).toBe(r.len);
      const { score, reasons } = analyzeText(r.content, r.rating);
      expect(score).toBe(r.score);
      expect(Array.isArray(reasons)).toBe(true);
      expect(decide(score)).toBe(r.verdict);
    });
  }
});

describe("decide — 경계값", () => {
  const cases = [
    [0, "게시"], [399, "게시"], [400, "보류"],
    [699, "보류"], [700, "거부"], [1000, "거부"],
  ];
  for (const [score, verdict] of cases) {
    it(`${score} → ${verdict}`, () => expect(decide(score)).toBe(verdict));
  }
});
