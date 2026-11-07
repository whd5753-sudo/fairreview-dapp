import { useState } from "react";
import { analyzeText, decide } from "./ai/engine.js";
import ReviewForm from "./components/ReviewForm.jsx";
import ResultCard from "./components/ResultCard.jsx";

// 상태(내용 · 별점 · 결과)는 App 에만 둔다. 점수 · 판정은 engine.js 에만 맡긴다.
export default function App() {
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(5);
  const [result, setResult] = useState(null);

  // 입력이 바뀌면 이전 결과는 지운다
  function changeContent(next) {
    setContent(next);
    setResult(null);
  }
  function changeRating(next) {
    setRating(next);
    setResult(null);
  }
  function fillExample(example) {
    setContent(example.content);
    setRating(example.rating);
    setResult(null);
  }

  function check() {
    const { score, reasons } = analyzeText(content, rating);
    setResult({ score, reasons, verdict: decide(score) });
  }

  return (
    <div className="page">
      <header className="header">
        <h1>FairReview</h1>
        <p>결제한 손님만 쓰는 공정한 리뷰</p>
      </header>
      <main>
        <ReviewForm
          content={content}
          rating={rating}
          onContentChange={changeContent}
          onRatingChange={changeRating}
          onExample={fillExample}
          onCheck={check}
        />
        {result && <ResultCard result={result} />}
      </main>
    </div>
  );
}
