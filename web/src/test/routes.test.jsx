// 6단계 화면 테스트 — docs/라우팅설계.md 6절의 8가지
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "../App.jsx";
import { WalletProvider } from "../state/WalletContext.jsx";
import { STORES } from "../data/stores.js";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WalletProvider>
        <App />
      </WalletProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  delete window.ethereum;
});

describe("라우팅", () => {
  it("1. / → '가게 둘러보기' 링크가 보인다", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: "가게 둘러보기" })).toBeTruthy();
  });

  it("2. /stores → 가게 3개 이름이 보인다", () => {
    renderAt("/stores");
    expect(STORES).toHaveLength(3);
    for (const store of STORES) {
      expect(screen.getByText(store.name)).toBeTruthy();
    }
  });

  it("3. /stores/1 → 1번 가게 이름이 보인다", () => {
    renderAt("/stores/1");
    expect(screen.getByRole("heading", { name: STORES[0].name })).toBeTruthy();
    expect(screen.getByRole("link", { name: "리뷰 쓰기" })).toBeTruthy();
  });

  it("4. /stores/999 → '없는 가게입니다' (404 화면이 아님)", () => {
    renderAt("/stores/999");
    expect(screen.getByText("없는 가게입니다")).toBeTruthy();
    expect(screen.getByRole("link", { name: "가게 목록으로" })).toBeTruthy();
    expect(screen.queryByText("페이지를 찾을 수 없습니다")).toBeNull();
  });

  it("5. /없는/주소 → '페이지를 찾을 수 없습니다' + 홈 링크", () => {
    renderAt("/없는/주소");
    expect(screen.getByText("페이지를 찾을 수 없습니다")).toBeTruthy();
    expect(screen.getByRole("link", { name: "홈으로" })).toBeTruthy();
  });

  it("6. /stores/1/review → 거부 예시 넣고 검사하기 → '판정: 거부'", () => {
    renderAt("/stores/1/review");
    expect(screen.getByRole("heading", { name: STORES[0].name })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "예시: 거부" }));
    fireEvent.click(screen.getByRole("button", { name: "검사하기" }));
    expect(screen.getByText("판정: 거부")).toBeTruthy();
  });
});

describe("지갑 Context", () => {
  it("7. MetaMask 가 없을 때 '지갑 연결' → 'MetaMask 가 필요합니다'", () => {
    delete window.ethereum;
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "지갑 연결" }));
    expect(screen.getByRole("alert").textContent).toBe("MetaMask 가 필요합니다");
  });
});

describe("글자 수", () => {
  it("8. 공백 포함 'a b' → '글자 수 3 / 300'", () => {
    renderAt("/stores/1/review");
    fireEvent.change(screen.getByLabelText("리뷰 내용"), { target: { value: "a b" } });
    expect(screen.getByText("글자 수 3 / 300 (공백 포함)")).toBeTruthy();
  });
});
