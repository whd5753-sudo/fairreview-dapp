// AI ① 문장 판정 엔진 — docs/기대값표.md 의 규칙을 그대로 옮긴 것

// 광고·대가성 패턴 (패턴마다 한 번만 센다)
export const AD_PATTERNS = [
  /협찬/,
  /체험단/,
  /원고료/,
  /소정의/,
  /제공\s*받/,
  /무료로\s*(제공|받)/,
  /리뷰\s*이벤트/,
  /이벤트\s*참여/,
  /서비스\s*받고/,
  /쿠폰\s*(받|주)/,
  /별점\s*5\s*(개|점)\s*(주면|드리면)/,
  /광고/,
];

// 과장 단어
export const HYPE_WORDS = [
  "최고", "강추", "대박", "인생맛집", "무조건", "완전", "존맛",
  "레전드", "미쳤", "꼭 가세요", "강력 추천", "역대급", "짱", "갓",
];

// 경험 단어
const EXPERIENCE =
  /메뉴|주문|시켰|먹었|국물|면|밥|고기|커피|디저트|가격|양이|웨이팅|주차|직원|사장님|자리|매장|포장|배달|맛이|간이/;

// 판정 경계
export const HOLD_MIN = 400;
export const REJECT_MIN = 700;

/** 글자 수: 앞뒤 공백 제거 후 모든 공백 문자를 뺀 글자 수 */
export function charCount(content) {
  return [...String(content ?? "").trim().replace(/\s/g, "")].length;
}

/** 구체성 (0~2): 숫자 +1, 경험 단어 +1 */
export function specificity(content) {
  const text = String(content ?? "");
  return (/\d/.test(text) ? 1 : 0) + (EXPERIENCE.test(text) ? 1 : 0);
}

export function analyzeText(content, rating) {
  const text = String(content ?? "");
  const len = charCount(text);
  const spec = specificity(text);
  const reasons = [];
  let score = 0;

  const ads = AD_PATTERNS.filter((p) => p.test(text)).length;
  if (ads >= 1) {
    const s = 450 + 100 * (ads - 1);
    score += s;
    reasons.push(`광고·대가성 문구 ${ads}건 (+${s})`);
  }

  const hype = HYPE_WORDS.filter((w) => text.includes(w)).length;
  if (hype >= 3) {
    const s = 120 + 40 * (hype - 3);
    score += s;
    reasons.push(`과장 표현 ${hype}개 (+${s})`);
  }

  const veryShortExtreme = len < 10 && (rating === 1 || rating === 5);
  if (veryShortExtreme) {
    score += 150;
    reasons.push("매우 짧은 극단 평점 (+150)");
  }

  if (!veryShortExtreme && spec === 0 && len < 40) {
    score += 100;
    reasons.push("구체성 없음 (+100)");
  }

  if (spec === 2 && len >= 30) {
    score -= 80;
    reasons.push("구체적 경험 보너스 (-80)");
  }

  score = Math.min(1000, Math.max(0, score));
  return { score, reasons };
}

/** 점수 → 판정: 0~399 게시, 400~699 보류, 700 이상 거부 */
export function decide(score) {
  if (score >= REJECT_MIN) return "거부";
  if (score >= HOLD_MIN) return "보류";
  return "게시";
}
