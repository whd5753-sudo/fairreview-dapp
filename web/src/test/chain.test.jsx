// 8단계 화면 테스트 — docs/화면연결설계.md 5절. 블록체인은 가짜(mock)로 바꿔서 돌린다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "../App.jsx";
import { WalletProvider } from "../state/WalletContext.jsx";
import { fetchPayment, fetchPoints, fetchStoreReviews, sendReview } from "../contracts/client.js";

vi.mock("../contracts/client.js", () => ({
  fetchPoints: vi.fn(),
  fetchPayment: vi.fn(),
  fetchStoreReviews: vi.fn(),
  sendReview: vi.fn(),
}));

const CUSTOMER = "0x24fa47419CE55143138B2D615bD426AEe2c7f4d0";
const OTHER = "0x8Dc9ee7b9843801769bC96F76048C9D367AA7c61";

// MetaMask 흉내: 계정 연결과 체인 id 만 돌려준다
function fakeMetaMask(chainId = "0xaa36a7") {
  return {
    on: vi.fn(),
    removeListener: vi.fn(),
    request: vi.fn(async ({ method }) => {
      if (method === "eth_chainId") return chainId;
      if (method === "eth_requestAccounts") return [CUSTOMER];
      if (method === "wallet_switchEthereumChain") return null;
      throw new Error("unexpected " + method);
    }),
  };
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WalletProvider>
        <App />
      </WalletProvider>
    </MemoryRouter>,
  );
}

// 리뷰 쓰기 화면에서 예시를 넣고 검사까지
async function checkExample(label) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: "검사하기" }));
}

async function connectWallet() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "지갑 연결" }));
  });
}

beforeEach(() => {
  fetchPoints.mockResolvedValue(90);
  fetchStoreReviews.mockResolvedValue([]);
  fetchPayment.mockResolvedValue({ storeId: 1, customer: CUSTOMER, reviewed: false, paidAt: 0 });
  sendReview.mockResolvedValue({ hash: "0xabc", wait: vi.fn().mockResolvedValue({}) });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete window.ethereum;
});

describe("블록체인 리뷰 목록", () => {
  it("1. /stores/1 → 블록체인 리뷰를 불러와 보여 준다", async () => {
    fetchStoreReviews.mockResolvedValue([
      { paymentId: 1, reviewer: CUSTOMER, rating: 5, content: "체인에 올린 리뷰", txHash: "0x1" },
    ]);
    renderAt("/stores/1");
    expect(screen.getByText("블록체인에서 리뷰를 불러오는 중…")).toBeTruthy();
    expect(await screen.findByText("체인에 올린 리뷰")).toBeTruthy();
    expect(fetchStoreReviews).toHaveBeenCalledWith(1);
  });

  it("2. 불러오기 실패 → 오류 문구 + 다시 시도", async () => {
    fetchStoreReviews.mockRejectedValue(new Error("network"));
    renderAt("/stores/1");
    expect(await screen.findByText(/블록체인 리뷰를 불러오지 못했습니다/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });

  it("3. 기록이 없으면 '아직 블록체인에 기록된 리뷰가 없습니다'", async () => {
    renderAt("/stores/2");
    expect(await screen.findByText("아직 블록체인에 기록된 리뷰가 없습니다.")).toBeTruthy();
  });
});

describe("블록체인에 제출", () => {
  it("4. 거부 판정 → 제출 버튼 없이 '올릴 수 없습니다'", async () => {
    renderAt("/stores/1/review");
    await checkExample("예시: 거부");
    expect(screen.getByText("거부 판정을 받은 리뷰는 블록체인에 올릴 수 없습니다.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "블록체인에 제출" })).toBeNull();
  });

  it("5. 보류 판정 → 지금은 제출할 수 없다는 안내", async () => {
    renderAt("/stores/1/review");
    await checkExample("예시: 보류");
    expect(screen.getByText(/보류 판정은 사람 검토가 필요해/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "블록체인에 제출" })).toBeNull();
  });

  it("6. 게시 판정 + 지갑 없음 → 지갑 연결 안내", async () => {
    renderAt("/stores/1/review");
    await checkExample("예시: 게시");
    expect(screen.getByText(/지갑을 연결해야 제출할 수 있습니다/)).toBeTruthy();
  });

  it("7. 게시 + Sepolia 가 아닌 네트워크 → 'Sepolia 로 전환' 버튼", async () => {
    window.ethereum = fakeMetaMask("0x1");
    renderAt("/stores/1/review");
    await connectWallet();
    await checkExample("예시: 게시");
    expect(screen.getByText(/Sepolia 네트워크에서만 제출할 수 있습니다/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "블록체인에 제출" })).toBeNull();
  });

  it("8. 게시 + Sepolia + 결제 1번 → MetaMask 서명 → 제출 완료 · Etherscan 링크 · 포인트 다시 읽기", async () => {
    window.ethereum = fakeMetaMask();
    renderAt("/stores/1/review");
    await connectWallet();
    expect(await screen.findByText("포인트 90P")).toBeTruthy();

    await checkExample("예시: 게시");
    fireEvent.change(screen.getByLabelText("결제 번호"), { target: { value: "1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "블록체인에 제출" }));
    });

    expect(await screen.findByText(/제출 완료/)).toBeTruthy();
    expect(sendReview).toHaveBeenCalledWith(window.ethereum, {
      paymentId: 1,
      rating: 5,
      content: expect.stringContaining("김치찌개"),
    });
    expect(screen.getByRole("link", { name: "Etherscan 에서 트랜잭션 보기" }).getAttribute("href")).toBe(
      "https://sepolia.etherscan.io/tx/0xabc",
    );
    expect(fetchPoints.mock.calls.length).toBeGreaterThanOrEqual(2); // 연결 때 + 제출 후
  });

  it("9. 다른 가게의 결제 번호 → 서명 요청 전에 막는다", async () => {
    fetchPayment.mockResolvedValue({ storeId: 2, customer: CUSTOMER, reviewed: false, paidAt: 0 });
    window.ethereum = fakeMetaMask();
    renderAt("/stores/1/review");
    await connectWallet();
    await checkExample("예시: 게시");
    fireEvent.change(screen.getByLabelText("결제 번호"), { target: { value: "1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "블록체인에 제출" }));
    });
    expect(await screen.findByText("이 가게의 결제가 아닙니다. 결제 번호를 확인해 주세요")).toBeTruthy();
    expect(sendReview).not.toHaveBeenCalled();
  });

  it("10. 남의 결제 · 이미 쓴 결제 · 없는 결제도 서명 전에 막는다", async () => {
    window.ethereum = fakeMetaMask();
    renderAt("/stores/1/review");
    await connectWallet();
    await checkExample("예시: 게시");
    const input = screen.getByLabelText("결제 번호");
    const cases = [
      [{ storeId: 1, customer: OTHER, reviewed: false }, "이 결제를 한 손님의 지갑이 아닙니다"],
      [{ storeId: 1, customer: CUSTOMER, reviewed: true }, "이미 리뷰를 쓴 결제입니다"],
      [null, "없는 결제 번호입니다"],
    ];
    for (const [payment, text] of cases) {
      fetchPayment.mockResolvedValue(payment);
      fireEvent.change(input, { target: { value: "1" } });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "블록체인에 제출" }));
      });
      expect(await screen.findByText(text)).toBeTruthy();
    }
    expect(sendReview).not.toHaveBeenCalled();
  });

  it("11. MetaMask 에서 취소 → '요청을 취소했습니다'", async () => {
    sendReview.mockRejectedValue({ code: "ACTION_REJECTED" });
    window.ethereum = fakeMetaMask();
    renderAt("/stores/1/review");
    await connectWallet();
    await checkExample("예시: 게시");
    fireEvent.change(screen.getByLabelText("결제 번호"), { target: { value: "1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "블록체인에 제출" }));
    });
    expect(await screen.findByText("MetaMask 에서 요청을 취소했습니다")).toBeTruthy();
  });
});

describe("9단계 보안 점검", () => {
  it("12. 제출 칸에 '공개 · 지울 수 없음 · 개인정보 금지' 안내가 있다 (T4)", async () => {
    window.ethereum = fakeMetaMask();
    renderAt("/stores/1/review");
    await connectWallet();
    await checkExample("예시: 게시");
    expect(screen.getByText(/누구나 볼 수 있고 지울 수 없습니다/)).toBeTruthy();
  });
});
