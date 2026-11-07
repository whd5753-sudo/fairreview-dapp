// 판정 → 배지 색 (글자로도 판정을 함께 표시한다)
const VERDICT_CLASS = {
  게시: "badge publish",
  보류: "badge hold",
  거부: "badge reject",
};

export default function ResultCard({ result }) {
  const { score, verdict, reasons } = result;

  return (
    <section className="card" aria-labelledby="result-title" aria-live="polite">
      <h2 id="result-title">검사 결과</h2>

      <div className="result-row">
        <p className="score">
          <strong>{score}</strong> / 1000
        </p>
        <span className={VERDICT_CLASS[verdict]}>판정: {verdict}</span>
      </div>

      <h3>이유</h3>
      {reasons.length === 0 ? (
        <p className="no-reasons">걸린 규칙 없음</p>
      ) : (
        <ul className="reasons">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      <p className="notice">
        이 결과는 미리 보기입니다. 실제 게시 여부는 8단계에서 컨트랙트가 결정합니다.
      </p>
    </section>
  );
}
