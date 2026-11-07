// 7단계 시나리오 자동 실행 (docs/컨트랙트설계.md 3번 표) — Remix 전용 스크립트
// 쓰는 법: Remix 의 scripts 폴더에 이 파일을 만들고, contracts/FairReview.sol 을 0.8.24 로 컴파일한 뒤
//          이 파일을 열고 Ctrl+Shift+S (또는 파일 오른쪽 클릭 → Run)
// Remix VM 계정: 0번 관리자 · 1번 사장님 · 2번 손님 · 3번 모르는 사람
import { ethers } from 'ethers'

(async () => {
  const meta = JSON.parse(await remix.call('fileManager', 'getFile', 'browser/artifacts/FairReview.json'))
  const provider = new ethers.providers.Web3Provider(web3Provider)
  const [admin, owner, customer, stranger] = [0, 1, 2, 3].map((i) => provider.getSigner(i))
  const iface = new ethers.utils.Interface(meta.abi)

  // 실패 이유(custom error 이름) 꺼내기: 오류 안에서 각 error 의 4바이트 선택자를 찾는다
  const selectors = Object.values(iface.errors).map((f) => [iface.getSighash(f).slice(2).toLowerCase(), f.name])
  function errorName(e) {
    let text = String(e && e.message)
    try { text += JSON.stringify(e) } catch (_) {}
    text = text.toLowerCase()
    for (const [sel, name] of selectors) if (text.includes(sel)) return name
    return 'reverted'
  }
  // 먼저 callStatic 으로 미리 실행해 보고(실패 이유 확인), 통과하면 진짜 트랜잭션을 보낸다
  async function step(label, contract, method, args, expectFail) {
    try {
      await contract.callStatic[method](...args)
      const tx = await contract[method](...args)
      await tx.wait()
      console.log((expectFail ? '⚠ 막혀야 하는데 통과: ' : '✔ ') + label)
    } catch (e) {
      console.log((expectFail ? '✔ 막힘 → ' : '✘ 실패 → ') + errorName(e) + ' : ' + label)
    }
  }

  const ownerAddr = await owner.getAddress()
  const customerAddr = await customer.getAddress()

  const factory = new ethers.ContractFactory(meta.abi, meta.data.bytecode.object, admin)
  const c = await factory.deploy()
  await c.deployed()
  console.log('1. 배포 완료 — 컨트랙트 주소 ' + c.address + ' (관리자 ' + (await admin.getAddress()) + ')')

  await step('2. 관리자가 가게 등록 (사장님 ' + ownerAddr + ')', c.connect(admin), 'registerStore', [ownerAddr, '온정 김치찌개'])
  console.log('   storeCount = ' + (await c.storeCount()) + ', stores(1).owner = ' + (await c.stores(1)).owner)
  await step('3. 손님이 결제 기록 시도', c.connect(customer), 'recordPayment', [1, customerAddr, 9000], true)
  await step('4. 사장님이 결제 기록 9000원', c.connect(owner), 'recordPayment', [1, customerAddr, 9000])
  console.log('   points(손님) = ' + (await c.points(customerAddr)))
  await step('5. 모르는 사람이 리뷰 시도', c.connect(stranger), 'submitReview', [1, 5, '맛있어요'], true)
  await step('6. 손님이 리뷰', c.connect(customer), 'submitReview', [1, 5, '김치찌개 9천원, 국물이 진했어요'])
  console.log('   points(손님) = ' + (await c.points(customerAddr)))
  await step('7. 같은 결제로 리뷰 한 번 더', c.connect(customer), 'submitReview', [1, 5, '김치찌개 9천원, 국물이 진했어요'], true)
  await step('8. 사장님이 자기 자신에게 결제 기록', c.connect(owner), 'recordPayment', [1, ownerAddr, 9000], true)
  console.log('끝. points(손님) 최종 = ' + (await c.points(customerAddr)))
})()
