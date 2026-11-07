// 8단계: 컨트랙트 설정 · 오류 변환 테스트 (docs/화면연결설계.md 5절)
import { describe, expect, it } from "vitest";
import { getAddress, Interface } from "ethers";
import { FAIR_REVIEW_ABI, FAIR_REVIEW_ADDRESS, txUrl } from "./fairReview.js";
import { ERROR_MESSAGES, errorName, toKoreanError } from "./errors.js";

describe("컨트랙트 설정", () => {
  it("주소는 체크섬까지 맞는 올바른 주소다 (한 글자만 틀려도 실패)", () => {
    expect(getAddress(FAIR_REVIEW_ADDRESS)).toBe(FAIR_REVIEW_ADDRESS);
  });

  it("ABI 를 읽을 수 있고, 화면이 쓰는 함수가 다 들어 있다", () => {
    const iface = new Interface(FAIR_REVIEW_ABI);
    for (const name of ["points", "stores", "payments", "submitReview"]) {
      expect(iface.getFunction(name)).toBeTruthy();
    }
    expect(iface.getEvent("ReviewSubmitted")).toBeTruthy();
  });

  it("리뷰 관련 custom error 는 모두 한국어 문장이 있다", () => {
    const iface = new Interface(FAIR_REVIEW_ABI);
    iface.forEachError((e) => expect(ERROR_MESSAGES[e.name]).toBeTruthy());
  });

  it("Etherscan 링크는 Sepolia 탐색기를 가리킨다", () => {
    expect(txUrl("0x12")).toBe("https://sepolia.etherscan.io/tx/0x12");
  });
});

describe("오류 → 한국어", () => {
  it("ethers 가 해석한 custom error 이름을 쓴다", () => {
    expect(toKoreanError({ revert: { name: "AlreadyReviewed" } })).toBe("이미 리뷰를 쓴 결제입니다");
    expect(toKoreanError({ revert: { name: "ReviewExpired" } })).toBe("결제 후 30일이 지나 리뷰를 쓸 수 없습니다");
  });

  it("MetaMask 취소(ACTION_REJECTED · 4001)", () => {
    expect(errorName({ code: "ACTION_REJECTED" })).toBe("UserRejected");
    expect(errorName({ code: 4001 })).toBe("UserRejected");
  });

  it("수수료 부족", () => {
    expect(toKoreanError({ code: "INSUFFICIENT_FUNDS" })).toBe("수수료로 낼 SepoliaETH 가 부족합니다");
  });

  it("모르는 오류는 원래 메시지 대신 정해진 문장", () => {
    const text = toKoreanError(new Error("internal json-rpc error: 0xdeadbeef"));
    expect(text).toBe("블록체인 요청이 실패했습니다. 잠시 후 다시 시도해 주세요");
    expect(text).not.toContain("0x");
  });
});
