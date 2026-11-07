// docs/테스트설계.md 의 표를 그대로 옮긴 테스트 — 실패하면 표가 아니라 코드를 고친다
// 10단계: 리뷰는 AI 오라클 서명이 있어야 한다 → 오라클 서버와 같은 서명 코드(oracle/sign.mjs)로 서명한다
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

let signVerdict; // oracle/sign.mjs (ESM) 를 불러와 쓴다
before(async function () {
  ({ signVerdict } = await import(pathToFileURL(path.join(__dirname, "..", "..", "oracle", "sign.mjs")).href));
});

const STORE_NAME = "온정 김치찌개";
const CONTENT = "김치찌개 9천원, 국물이 진하고 양이 많았어요";
const DAY = 24 * 60 * 60;

// 기본 준비: 오라클 지갑 · 배포 → admin 이 가게 1번 등록 (사장님 = owner)
async function deployFixture() {
  const [admin, owner, customer, stranger, customer2] = await ethers.getSigners();
  const oracle = ethers.Wallet.createRandom(); // 오라클 서버의 지갑 (서명만 한다)
  const fr = await ethers.deployContract("FairReview", [oracle.address]);
  await fr.connect(admin).registerStore(owner.address, STORE_NAME);
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const contract = await fr.getAddress();
  // 오라클이 서명한 리뷰 제출 (sign 으로 서명 내용을 바꿔 위조 실험도 한다)
  async function review(signer, paymentId, rating, content, score = 0, sign = {}) {
    const fields = { chainId, contract, paymentId, reviewer: signer.address, rating, content, score, ...sign };
    const signature = await signVerdict(sign.wallet ?? oracle, fields);
    return fr.connect(signer).submitReview(paymentId, rating, content, score, signature);
  }
  return { fr, admin, owner, customer, stranger, customer2, oracle, review, chainId, contract };
}

// 준비 + 결제 1번 (owner → customer, 9000원)
async function paidFixture() {
  const base = await deployFixture();
  await base.fr.connect(base.owner).recordPayment(1, base.customer.address, 9000);
  const paidAt = (await base.fr.payments(1)).paidAt;
  return { ...base, paidAt };
}

describe("FairReview — 테스트 설계 표", function () {
  describe("A. 가게 등록", function () {
    it("A1 admin 이 등록하면 storeCount 1, stores(1), StoreRegistered 이벤트", async function () {
      const [admin, owner] = await ethers.getSigners();
      const fr = await ethers.deployContract("FairReview", [ethers.Wallet.createRandom().address]);
      await expect(fr.connect(admin).registerStore(owner.address, STORE_NAME))
        .to.emit(fr, "StoreRegistered")
        .withArgs(1, owner.address, STORE_NAME);
      expect(await fr.storeCount()).to.equal(1);
      const store = await fr.stores(1);
      expect(store.owner).to.equal(owner.address);
      expect(store.name).to.equal(STORE_NAME);
    });

    it("A2 stranger 가 등록하면 NotAdmin", async function () {
      const { fr, owner, stranger } = await loadFixture(deployFixture);
      await expect(fr.connect(stranger).registerStore(owner.address, "가게"))
        .to.be.revertedWithCustomError(fr, "NotAdmin");
    });

    it("A3 owner 주소가 0 이면 ZeroAddress", async function () {
      const { fr } = await loadFixture(deployFixture);
      await expect(fr.registerStore(ethers.ZeroAddress, "가게"))
        .to.be.revertedWithCustomError(fr, "ZeroAddress");
    });

    it("A4 이름이 빈 문자열이면 EmptyName", async function () {
      const { fr, owner } = await loadFixture(deployFixture);
      await expect(fr.registerStore(owner.address, ""))
        .to.be.revertedWithCustomError(fr, "EmptyName");
    });
  });

  describe("B. 결제 기록", function () {
    it("B1 owner 가 customer 에게 9000원 → paymentCount 1, 포인트 90, PaymentRecorded", async function () {
      const { fr, owner, customer } = await loadFixture(deployFixture);
      await expect(fr.connect(owner).recordPayment(1, customer.address, 9000))
        .to.emit(fr, "PaymentRecorded")
        .withArgs(1, 1, customer.address, 9000, 90);
      expect(await fr.paymentCount()).to.equal(1);
      expect(await fr.points(customer.address)).to.equal(90);
    });

    it("B2 stranger 가 기록하면 NotStoreOwner(1)", async function () {
      const { fr, customer, stranger } = await loadFixture(deployFixture);
      await expect(fr.connect(stranger).recordPayment(1, customer.address, 9000))
        .to.be.revertedWithCustomError(fr, "NotStoreOwner")
        .withArgs(1);
    });

    it("B3 없는 가게 2번이면 StoreNotFound(2)", async function () {
      const { fr, owner, customer } = await loadFixture(deployFixture);
      await expect(fr.connect(owner).recordPayment(2, customer.address, 9000))
        .to.be.revertedWithCustomError(fr, "StoreNotFound")
        .withArgs(2);
    });

    it("B4 손님 주소가 0 이면 ZeroAddress", async function () {
      const { fr, owner } = await loadFixture(deployFixture);
      await expect(fr.connect(owner).recordPayment(1, ethers.ZeroAddress, 9000))
        .to.be.revertedWithCustomError(fr, "ZeroAddress");
    });

    it("B5 금액 0 이면 InvalidAmount", async function () {
      const { fr, owner, customer } = await loadFixture(deployFixture);
      await expect(fr.connect(owner).recordPayment(1, customer.address, 0))
        .to.be.revertedWithCustomError(fr, "InvalidAmount");
    });

    it("B6 금액 10,000,001 은 InvalidAmount, 10,000,000 은 통과", async function () {
      const { fr, owner, customer } = await loadFixture(deployFixture);
      await expect(fr.connect(owner).recordPayment(1, customer.address, 10_000_001))
        .to.be.revertedWithCustomError(fr, "InvalidAmount");
      await expect(fr.connect(owner).recordPayment(1, customer.address, 10_000_000)).not.to.be.reverted;
    });

    it("B7 owner 가 자기 자신에게 기록하면 SelfPayment", async function () {
      const { fr, owner } = await loadFixture(deployFixture);
      await expect(fr.connect(owner).recordPayment(1, owner.address, 9000))
        .to.be.revertedWithCustomError(fr, "SelfPayment");
    });

    it("B8 50원 결제는 통과하고 적립은 0", async function () {
      const { fr, owner, customer } = await loadFixture(deployFixture);
      await expect(fr.connect(owner).recordPayment(1, customer.address, 50))
        .to.emit(fr, "PaymentRecorded")
        .withArgs(1, 1, customer.address, 50, 0);
      expect(await fr.points(customer.address)).to.equal(0);
    });
  });

  describe("C. 리뷰 제출", function () {
    it("C1 customer 가 1번 결제로 별점 5 → 포인트 100, reviewed true, ReviewSubmitted", async function () {
      const { fr, customer, review } = await loadFixture(paidFixture);
      await expect(review(customer, 1, 5, CONTENT))
        .to.emit(fr, "ReviewSubmitted")
        .withArgs(1, 1, customer.address, 5, CONTENT, 0);
      expect(await fr.points(customer.address)).to.equal(100);
      expect((await fr.payments(1)).reviewed).to.equal(true);
    });

    it("C2 없는 결제 9번이면 PaymentNotFound(9)", async function () {
      const { fr, customer, review } = await loadFixture(paidFixture);
      await expect(review(customer, 9, 5, CONTENT))
        .to.be.revertedWithCustomError(fr, "PaymentNotFound")
        .withArgs(9);
    });

    it("C3 stranger 가 1번 결제로 쓰면 NotPaymentCustomer(1)", async function () {
      const { fr, stranger, review } = await loadFixture(paidFixture);
      await expect(review(stranger, 1, 5, CONTENT))
        .to.be.revertedWithCustomError(fr, "NotPaymentCustomer")
        .withArgs(1);
    });

    it("C4 같은 결제로 두 번째 리뷰는 AlreadyReviewed(1)", async function () {
      const { fr, customer, review } = await loadFixture(paidFixture);
      await review(customer, 1, 5, CONTENT);
      await expect(review(customer, 1, 4, CONTENT))
        .to.be.revertedWithCustomError(fr, "AlreadyReviewed")
        .withArgs(1);
    });

    it("C5 결제 후 정확히 30일이면 통과", async function () {
      const { fr, customer, paidAt, review } = await loadFixture(paidFixture);
      await time.setNextBlockTimestamp(paidAt + BigInt(30 * DAY));
      await expect(review(customer, 1, 5, CONTENT)).not.to.be.reverted;
    });

    it("C6 결제 후 30일 + 1초면 ReviewExpired(1)", async function () {
      const { fr, customer, paidAt, review } = await loadFixture(paidFixture);
      await time.setNextBlockTimestamp(paidAt + BigInt(30 * DAY + 1));
      await expect(review(customer, 1, 5, CONTENT))
        .to.be.revertedWithCustomError(fr, "ReviewExpired")
        .withArgs(1);
    });

    it("C7 별점 0 은 InvalidRating(0), 별점 6 은 InvalidRating(6)", async function () {
      const { fr, customer, review } = await loadFixture(paidFixture);
      await expect(review(customer, 1, 0, CONTENT))
        .to.be.revertedWithCustomError(fr, "InvalidRating")
        .withArgs(0);
      await expect(review(customer, 1, 6, CONTENT))
        .to.be.revertedWithCustomError(fr, "InvalidRating")
        .withArgs(6);
    });

    it("C8 내용이 빈 문자열이면 EmptyContent", async function () {
      const { fr, customer, review } = await loadFixture(paidFixture);
      await expect(review(customer, 1, 5, ""))
        .to.be.revertedWithCustomError(fr, "EmptyContent");
    });

    it("C9 한글 300자(900바이트)는 통과, 301자(903바이트)는 ContentTooLong", async function () {
      const { fr, customer, review } = await loadFixture(paidFixture);
      const tooLong = "가".repeat(301);
      expect(Buffer.byteLength(tooLong, "utf8")).to.equal(903);
      await expect(review(customer, 1, 5, tooLong))
        .to.be.revertedWithCustomError(fr, "ContentTooLong");

      const justFits = "가".repeat(300);
      expect(Buffer.byteLength(justFits, "utf8")).to.equal(900);
      await expect(review(customer, 1, 5, justFits)).not.to.be.reverted;
    });

    it("C10 별점 1 리뷰와 별점 5 리뷰의 보상이 똑같이 10", async function () {
      const { fr, owner, customer, customer2, review } = await loadFixture(paidFixture);
      await fr.connect(owner).recordPayment(1, customer2.address, 9000); // 결제 2번

      const before1 = await fr.points(customer.address);
      const before2 = await fr.points(customer2.address);
      await review(customer, 1, 1, CONTENT);
      await review(customer2, 2, 5, CONTENT);

      expect((await fr.points(customer.address)) - before1).to.equal(10);
      expect((await fr.points(customer2.address)) - before2).to.equal(10);
    });
  });

  describe("D. 비상 중지 · 포인트", function () {
    it("D1 stranger 가 pause 하면 NotAdmin", async function () {
      const { fr, stranger } = await loadFixture(paidFixture);
      await expect(fr.connect(stranger).pause()).to.be.revertedWithCustomError(fr, "NotAdmin");
    });

    it("D2 pause 후 등록 · 결제 · 리뷰는 모두 ContractPaused, Paused 이벤트", async function () {
      const { fr, admin, owner, customer, review } = await loadFixture(paidFixture);
      await expect(fr.connect(admin).pause()).to.emit(fr, "Paused").withArgs(admin.address);

      await expect(fr.registerStore(owner.address, "가게"))
        .to.be.revertedWithCustomError(fr, "ContractPaused");
      await expect(fr.connect(owner).recordPayment(1, customer.address, 9000))
        .to.be.revertedWithCustomError(fr, "ContractPaused");
      await expect(review(customer, 1, 5, CONTENT))
        .to.be.revertedWithCustomError(fr, "ContractPaused");
    });

    it("D3 unpause 후 다시 결제 기록 가능, Unpaused 이벤트", async function () {
      const { fr, admin, owner, customer } = await loadFixture(paidFixture);
      await fr.connect(admin).pause();
      await expect(fr.connect(admin).unpause()).to.emit(fr, "Unpaused").withArgs(admin.address);
      await expect(fr.connect(owner).recordPayment(1, customer.address, 9000)).not.to.be.reverted;
    });

    it("D4 포인트는 넘길 수 없다 — ABI 에 transfer · approve · transferFrom 이 없다", async function () {
      const { fr } = await loadFixture(deployFixture);
      const names = fr.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
      for (const banned of ["transfer", "approve", "transferFrom"]) {
        expect(names).to.not.include(banned);
      }
    });
  });

  describe("F. AI 오라클 서명 (10단계)", function () {
    const HOLD_CONTENT = "체험단으로 다녀왔어요. 분위기 괜찮았어요"; // 기대값 표 4번 = 550 보류

    it("F1 점수 550 → 보류: ReviewHeld 이벤트, 상태 Held(2), 포인트 그대로", async function () {
      const { fr, customer, review } = await loadFixture(paidFixture);
      const before = await fr.points(customer.address);
      await expect(review(customer, 1, 4, HOLD_CONTENT, 550))
        .to.emit(fr, "ReviewHeld")
        .withArgs(1, 1, customer.address, 4, HOLD_CONTENT, 550);
      expect(await fr.reviewStatus(1)).to.equal(2);
      expect(await fr.points(customer.address)).to.equal(before);
      expect((await fr.payments(1)).reviewed).to.equal(true);
    });

    it("F2 경계값: 399 게시 · 400 보류 · 699 보류 · 700 SuspectedFakeReview(700)", async function () {
      const { fr, owner, customer, review } = await loadFixture(paidFixture);
      for (let i = 0; i < 3; i++) await fr.connect(owner).recordPayment(1, customer.address, 9000); // 결제 2·3·4번
      await expect(review(customer, 1, 5, CONTENT, 399)).to.emit(fr, "ReviewSubmitted");
      await expect(review(customer, 2, 5, CONTENT, 400)).to.emit(fr, "ReviewHeld");
      await expect(review(customer, 3, 5, CONTENT, 699)).to.emit(fr, "ReviewHeld");
      await expect(review(customer, 4, 5, CONTENT, 700))
        .to.be.revertedWithCustomError(fr, "SuspectedFakeReview")
        .withArgs(700);
      expect((await fr.payments(4)).reviewed).to.equal(false); // 거부된 리뷰는 기록되지 않는다
    });

    it("F3 오라클이 아닌 지갑의 서명은 InvalidOracleSignature", async function () {
      const { fr, customer, review } = await loadFixture(paidFixture);
      await expect(review(customer, 1, 5, CONTENT, 0, { wallet: ethers.Wallet.createRandom() }))
        .to.be.revertedWithCustomError(fr, "InvalidOracleSignature");
    });

    it("F4 서명 받은 뒤 내용 · 점수 · 별점을 바꾸면 InvalidOracleSignature", async function () {
      const { fr, customer, review } = await loadFixture(paidFixture);
      // 서명은 원래 값으로, 제출은 바꾼 값으로
      await expect(review(customer, 1, 5, CONTENT + " 최고", 0, { content: CONTENT }))
        .to.be.revertedWithCustomError(fr, "InvalidOracleSignature");
      await expect(review(customer, 1, 5, CONTENT, 0, { score: 550 }))
        .to.be.revertedWithCustomError(fr, "InvalidOracleSignature");
      await expect(review(customer, 1, 5, CONTENT, 0, { rating: 1 }))
        .to.be.revertedWithCustomError(fr, "InvalidOracleSignature");
    });

    it("F5 다른 결제 · 다른 사람 · 다른 컨트랙트 · 다른 체인용 서명은 쓸 수 없다", async function () {
      const { fr, owner, customer, customer2, review } = await loadFixture(paidFixture);
      await fr.connect(owner).recordPayment(1, customer2.address, 9000); // 결제 2번 = customer2
      await expect(review(customer, 1, 5, CONTENT, 0, { paymentId: 2 }))
        .to.be.revertedWithCustomError(fr, "InvalidOracleSignature");
      await expect(review(customer, 1, 5, CONTENT, 0, { reviewer: customer2.address }))
        .to.be.revertedWithCustomError(fr, "InvalidOracleSignature");
      await expect(review(customer, 1, 5, CONTENT, 0, { contract: owner.address }))
        .to.be.revertedWithCustomError(fr, "InvalidOracleSignature");
      await expect(review(customer, 1, 5, CONTENT, 0, { chainId: 1n }))
        .to.be.revertedWithCustomError(fr, "InvalidOracleSignature");
    });

    it("F6 망가진 서명(길이 틀림 · 빈 서명)은 InvalidOracleSignature", async function () {
      const { fr, customer } = await loadFixture(paidFixture);
      await expect(fr.connect(customer).submitReview(1, 5, CONTENT, 0, "0x1234"))
        .to.be.revertedWithCustomError(fr, "InvalidOracleSignature");
      await expect(fr.connect(customer).submitReview(1, 5, CONTENT, 0, "0x"))
        .to.be.revertedWithCustomError(fr, "InvalidOracleSignature");
    });

    it("F7 점수 1001 은 InvalidScore(1001)", async function () {
      const { fr, customer, review } = await loadFixture(paidFixture);
      await expect(review(customer, 1, 5, CONTENT, 1001))
        .to.be.revertedWithCustomError(fr, "InvalidScore")
        .withArgs(1001);
    });

    it("F8 관리자가 보류 승인 → 게시(1) · 포인트 +10 · HeldReviewResolved(true)", async function () {
      const { fr, admin, customer, review } = await loadFixture(paidFixture);
      await review(customer, 1, 4, HOLD_CONTENT, 550);
      const before = await fr.points(customer.address);
      await expect(fr.connect(admin).resolveHeld(1, true)).to.emit(fr, "HeldReviewResolved").withArgs(1, 1, true);
      expect(await fr.reviewStatus(1)).to.equal(1);
      expect((await fr.points(customer.address)) - before).to.equal(10);
    });

    it("F9 관리자가 보류 거절 → 거절(3) · 포인트 그대로 · 다시 검토하면 NotHeld", async function () {
      const { fr, admin, customer, review } = await loadFixture(paidFixture);
      await review(customer, 1, 4, HOLD_CONTENT, 550);
      const before = await fr.points(customer.address);
      await expect(fr.connect(admin).resolveHeld(1, false)).to.emit(fr, "HeldReviewResolved").withArgs(1, 1, false);
      expect(await fr.reviewStatus(1)).to.equal(3);
      expect(await fr.points(customer.address)).to.equal(before);
      await expect(fr.connect(admin).resolveHeld(1, true)).to.be.revertedWithCustomError(fr, "NotHeld").withArgs(1);
    });

    it("F10 보류 검토는 관리자만 (사장님 · 손님은 NotAdmin), 보류가 아니면 NotHeld", async function () {
      const { fr, owner, customer, review } = await loadFixture(paidFixture);
      await expect(fr.resolveHeld(1, true)).to.be.revertedWithCustomError(fr, "NotHeld").withArgs(1);
      await review(customer, 1, 4, HOLD_CONTENT, 550);
      await expect(fr.connect(owner).resolveHeld(1, true)).to.be.revertedWithCustomError(fr, "NotAdmin");
      await expect(fr.connect(customer).resolveHeld(1, true)).to.be.revertedWithCustomError(fr, "NotAdmin");
    });

    it("F11 오라클 주소 0 으로는 배포할 수 없다 (ZeroAddress), admin · oracle 은 배포 때 고정", async function () {
      const factory = await ethers.getContractFactory("FairReview");
      await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(factory, "ZeroAddress");
      const { fr, admin, oracle } = await loadFixture(deployFixture);
      expect(await fr.admin()).to.equal(admin.address);
      expect(await fr.oracle()).to.equal(oracle.address);
    });

    it("F12 비상 중지 중에는 보류 검토도 ContractPaused", async function () {
      const { fr, admin, customer, review } = await loadFixture(paidFixture);
      await review(customer, 1, 4, HOLD_CONTENT, 550);
      await fr.connect(admin).pause();
      await expect(fr.connect(admin).resolveHeld(1, true)).to.be.revertedWithCustomError(fr, "ContractPaused");
    });
  });

  describe("E. 가스 (참고용 출력)", function () {
    it("E1 registerStore · recordPayment · submitReview 의 gasUsed 출력", async function () {
      const { fr, owner, customer, review } = await loadFixture(deployFixture);
      const r2 = await (await fr.connect(owner).recordPayment(1, customer.address, 9000)).wait();
      const r3 = await (await review(customer, 1, 5, CONTENT)).wait();
      const r1 = await (await fr.registerStore(owner.address, "두 번째 가게")).wait();
      console.log(`      가스: registerStore ${r1.gasUsed} · recordPayment ${r2.gasUsed} · submitReview ${r3.gasUsed}`);
    });
  });
});
