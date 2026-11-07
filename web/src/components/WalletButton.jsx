import { shortAddress, useWallet } from "../state/WalletContext.jsx";

// 머리글 오른쪽: 연결 전 '지갑 연결', 연결 후 0x1234…abcd + 포인트 + 연결 끊기
// 8단계: Sepolia 가 아니면 'Sepolia 로 전환' 버튼, Sepolia 면 내 포인트 표시
export default function WalletButton() {
  const { account, isSepolia, connect, disconnect, switchToSepolia, points, error } = useWallet();

  return (
    <div className="wallet">
      {account ? (
        <>
          <span className="address" title={account}>
            {shortAddress(account)}
          </span>
          {isSepolia && points !== null && <span className="points">포인트 {points}P</span>}
          <button type="button" className="wallet-button" onClick={disconnect}>
            연결 끊기
          </button>
        </>
      ) : (
        <button type="button" className="wallet-button" onClick={connect}>
          지갑 연결
        </button>
      )}
      {account && !isSepolia && (
        <p className="wallet-warning" role="alert">
          Sepolia 로 바꿔 주세요{" "}
          <button type="button" className="link-like" onClick={switchToSepolia}>
            Sepolia 로 전환
          </button>
        </p>
      )}
      {error && (
        <p className="wallet-warning" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
