import { charCount } from "../ai/engine.js";

const MAX_LENGTH = 300;

// docs/기대값표.md 의 1번(게시) · 4번(보류) · 3번(거부) 행
const EXAMPLES = [
  {
    label: "예시: 게시",
    rating: 5,
    content:
      "오늘 점심에 김치찌개 시켰는데 국물이 진하고 고기도 넉넉했어요. 9천원이고 사장님도 친절하셨어요",
  },
  {
    label: "예시: 보류",
    rating: 4,
    content: "체험단으로 다녀왔어요. 분위기 괜찮았어요",
  },
  {
    label: "예시: 거부",
    rating: 5,
    content: "체험단으로 무료로 제공받았어요 완전 대박 최고 강추 인생맛집 무조건 가세요",
  },
];

export default function ReviewForm({
  content,
  rating,
  onContentChange,
  onRatingChange,
  onExample,
  onCheck,
}) {
  const isEmpty = content.trim() === "";

  return (
    <section className="card" aria-labelledby="form-title">
      <h2 id="form-title">리뷰 쓰기</h2>

      <div className="field">
        <span className="field-label" id="rating-label">
          별점
        </span>
        <div className="stars" role="group" aria-labelledby="rating-label">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={n === rating ? "star selected" : "star"}
              aria-pressed={n === rating}
              aria-label={`별점 ${n}점`}
              onClick={() => onRatingChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="review-content">
          리뷰 내용
        </label>
        <textarea
          id="review-content"
          rows={5}
          maxLength={MAX_LENGTH}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="방문해서 드신 메뉴, 가격, 느낀 점을 적어 주세요"
          aria-describedby="char-count"
        />
        <p className="char-count" id="char-count">
          글자 수 {charCount(content)} / {MAX_LENGTH}
        </p>
      </div>

      <button type="button" className="primary" disabled={isEmpty} onClick={onCheck}>
        검사하기
      </button>

      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" className="example" onClick={() => onExample(ex)}>
            {ex.label}
          </button>
        ))}
      </div>
    </section>
  );
}
