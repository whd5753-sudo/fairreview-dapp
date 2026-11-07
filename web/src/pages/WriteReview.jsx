import { useState } from "react";
import { Link, useParams } from "react-router";
import { analyzeText, decide } from "../ai/engine.js";
import { getStore } from "../data/stores.js";
import ReviewForm from "../components/ReviewForm.jsx";
import ResultCard from "../components/ResultCard.jsx";
import StoreMissing from "../components/StoreMissing.jsx";
import ChainSubmit from "../components/ChainSubmit.jsx";

// 5단계 App 화면을 옮긴 것. 입력 글자 · 별점 · 결과는 이 화면의 상태로만 둔다 (Context 에 넣지 않음).
export default function WriteReview() {
  const { id } = useParams();
  const store = getStore(id);
  if (!store) return <StoreMissing />;
  // key: 다른 가게로 옮기면 입력 상태를 새로 시작
  return <ReviewChecker key={store.id} store={store} />;
}

function ReviewChecker({ store }) {
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

  // 점수 · 판정은 engine.js 에만 맡긴다
  function check() {
    const { score, reasons } = analyzeText(content, rating);
    setResult({ score, reasons, verdict: decide(score) });
  }

  return (
    <>
      <div className="store-heading">
        <h2 className="page-title">{store.name}</h2>
        <Link to={`/stores/${store.id}`}>가게로 돌아가기</Link>
      </div>
      <ReviewForm
        content={content}
        rating={rating}
        onContentChange={changeContent}
        onRatingChange={changeRating}
        onExample={fillExample}
        onCheck={check}
      />
      {result && <ResultCard result={result} />}
      {/* 8단계: 검사 결과가 있을 때만 블록체인 제출 칸을 보여 준다 (입력이 바뀌면 결과와 함께 사라짐) */}
      {result && <ChainSubmit store={store} rating={rating} content={content} verdict={result.verdict} />}
    </>
  );
}
