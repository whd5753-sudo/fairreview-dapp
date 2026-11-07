// 6단계 예시 데이터 — 8단계에서 컨트랙트 조회로 바꾼다.
// :id 는 주소에서 온 문자열이므로 id 도 문자열로 두고 === 로 비교한다.
export const STORES = [
  {
    id: "1",
    name: "온정 김치찌개",
    category: "한식",
    menu: [
      { name: "김치찌개", price: 9000 },
      { name: "제육볶음", price: 10000 },
      { name: "계란말이", price: 7000 },
    ],
    reviews: [
      {
        rating: 5,
        content:
          "오늘 점심에 김치찌개 시켰는데 국물이 진하고 고기도 넉넉했어요. 9천원이고 사장님도 친절하셨어요",
      },
      {
        rating: 4,
        content: "제육볶음 주문했는데 양이 많았어요. 12시 반에 가니 웨이팅 10분 정도 있었어요",
      },
    ],
  },
  {
    id: "2",
    name: "모퉁이 커피",
    category: "카페",
    menu: [
      { name: "아메리카노", price: 4000 },
      { name: "카페라테", price: 4500 },
    ],
    reviews: [
      {
        rating: 4,
        content: "아메리카노 4천원인데 커피가 산미 없이 고소했어요. 매장 자리가 넓어서 2시간 있었어요",
      },
      {
        rating: 3,
        content: "디저트로 치즈케이크 먹었는데 조금 달았어요. 주차는 2대만 돼서 불편했어요",
      },
    ],
  },
  {
    id: "3",
    name: "바다 칼국수",
    category: "면 요리",
    menu: [
      { name: "바지락 칼국수", price: 9500 },
      { name: "왕만두", price: 6000 },
      { name: "보리밥", price: 3000 },
    ],
    reviews: [
      {
        rating: 5,
        content: "바지락 칼국수 시켰는데 면이 쫄깃하고 국물이 시원했어요. 보리밥은 3천원 추가였어요",
      },
      {
        rating: 4,
        content: "포장 주문했는데 15분 만에 나왔어요. 만두 6개에 6천원이라 가격도 괜찮았어요",
      },
    ],
  },
];

/** 문자열 id 로 가게 찾기. 없으면 undefined */
export function getStore(id) {
  return STORES.find((store) => store.id === id);
}
