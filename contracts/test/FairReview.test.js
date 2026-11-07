// docs/테스트설계.md 의 표를 그대로 옮긴 테스트 — 실패하면 표가 아니라 코드를 고친다
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const STORE_NAME = "온정 김치찌개";
const CONTENT = "김치찌개 9천원, 국물이 진하고 양이 많았어요";
const DAY = 24 * 60 * 60;

// 기본 준비: 배포 → admin 이 가게 1번 등록 (사장님 = owner)
async function deployFixture() {
  const [admin, owner, customer, stranger, customer2] = await ethers.getSigners();
  const fr = await ethers.deployContract("FairReview");
  await fr.connect(admin).registerStore(owner.address, STORE_NAME);
  return { fr, admin, owner, customer, stranger, customer2 };
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
      const fr = await ethers.deployContract("FairReview");
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
      const { fr, customer } = await loadFixture(paidFixture);
      await expect(fr.connect(customer).submitReview(1, 5, CONTENT))
        .to.emit(fr, "ReviewSubmitted")
        .withArgs(1, 1, customer.address, 5, CONTENT);
      expect(await fr.points(customer.address)).to.equal(100);
      expect((await fr.payments(1)).reviewed).to.equal(true);
    });

    it("C2 없는 결제 9번이면 PaymentNotFound(9)", async function () {
      const { fr, customer } = await loadFixture(paidFixture);
      await expect(fr.connect(customer).submitReview(9, 5, CONTENT))
        .to.be.revertedWithCustomError(fr, "PaymentNotFound")
        .withArgs(9);
    });

    it("C3 stranger 가 1번 결제로 쓰면 NotPaymentCustomer(1)", async function () {
      const { fr, stranger } = await loadFixture(paidFixture);
      await expect(fr.connect(stranger).submitReview(1, 5, CONTENT))
        .to.be.revertedWithCustomError(fr, "NotPaymentCustomer")
        .withArgs(1);
    });

    it("C4 같은 결제로 두 번째 리뷰는 AlreadyReviewed(1)", async function () {
      const { fr, customer } = await loadFixture(paidFixture);
      await fr.connect(customer).submitReview(1, 5, CONTENT);
      await expect(fr.connect(customer).submitReview(1, 4, CONTENT))
        .to.be.revertedWithCustomError(fr, "AlreadyReviewed")
        .withArgs(1);
    });

    it("C5 결제 후 정확히 30일이면 통과", async function () {
      const { fr, customer, paidAt } = await loadFixture(paidFixture);
      await time.setNextBlockTimestamp(paidAt + BigInt(30 * DAY));
      await expect(fr.connect(customer).submitReview(1, 5, CONTENT)).not.to.be.reverted;
    });

    it("C6 결제 후 30일 + 1초면 ReviewExpired(1)", async function () {
      const { fr, customer, paidAt } = await loadFixture(paidFixture);
      await time.setNextBlockTimestamp(paidAt + BigInt(30 * DAY + 1));
      await expect(fr.connect(customer).submitReview(1, 5, CONTENT))
        .to.be.revertedWithCustomError(fr, "ReviewExpired")
        .withArgs(1);
    });

    it("C7 별점 0 은 InvalidRating(0), 별점 6 은 InvalidRating(6)", async function () {
      const { fr, customer } = await loadFixture(paidFixture);
      await expect(fr.connect(customer).submitReview(1, 0, CONTENT))
        .to.be.revertedWithCustomError(fr, "InvalidRating")
        .withArgs(0);
      await expect(fr.connect(customer).submitReview(1, 6, CONTENT))
        .to.be.revertedWithCustomError(fr, "InvalidRating")
        .withArgs(6);
    });

    it("C8 내용이 빈 문자열이면 EmptyContent", async function () {
      const { fr, customer } = await loadFixture(paidFixture);
      await expect(fr.connect(customer).submitReview(1, 5, ""))
        .to.be.revertedWithCustomError(fr, "EmptyContent");
    });

    it("C9 한글 300자(900바이트)는 통과, 301자(903바이트)는 ContentTooLong", async function () {
      const { fr, owner, customer } = await loadFixture(paidFixture);
      const tooLong = "가".repeat(301);
      expect(Buffer.byteLength(tooLong, "utf8")).to.equal(903);
      await expect(fr.connect(customer).submitReview(1, 5, tooLong))
        .to.be.revertedWithCustomError(fr, "ContentTooLong");

      const justFits = "가".repeat(300);
      expect(Buffer.byteLength(justFits, "utf8")).to.equal(900);
      await expect(fr.connect(customer).submitReview(1, 5, justFits)).not.to.be.reverted;
    });

    it("C10 별점 1 리뷰와 별점 5 리뷰의 보상이 똑같이 10", async function () {
      const { fr, owner, customer, customer2 } = await loadFixture(paidFixture);
      await fr.connect(owner).recordPayment(1, customer2.address, 9000); // 결제 2번

      const before1 = await fr.points(customer.address);
      const before2 = await fr.points(customer2.address);
      await fr.connect(customer).submitReview(1, 1, CONTENT);
      await fr.connect(customer2).submitReview(2, 5, CONTENT);

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
      const { fr, admin, owner, customer } = await loadFixture(paidFixture);
      await expect(fr.connect(admin).pause()).to.emit(fr, "Paused").withArgs(admin.address);

      await expect(fr.registerStore(owner.address, "가게"))
        .to.be.revertedWithCustomError(fr, "ContractPaused");
      await expect(fr.connect(owner).recordPayment(1, customer.address, 9000))
        .to.be.revertedWithCustomError(fr, "ContractPaused");
      await expect(fr.connect(customer).submitReview(1, 5, CONTENT))
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

  describe("E. 가스 (참고용 출력)", function () {
    it("E1 registerStore · recordPayment · submitReview 의 gasUsed 출력", async function () {
      const [admin, owner, customer] = await ethers.getSigners();
      const fr = await ethers.deployContract("FairReview");
      const r1 = await (await fr.connect(admin).registerStore(owner.address, STORE_NAME)).wait();
      const r2 = await (await fr.connect(owner).recordPayment(1, customer.address, 9000)).wait();
      const r3 = await (await fr.connect(customer).submitReview(1, 5, CONTENT)).wait();
      console.log(`      가스: registerStore ${r1.gasUsed} · recordPayment ${r2.gasUsed} · submitReview ${r3.gasUsed}`);
    });
  });
});
