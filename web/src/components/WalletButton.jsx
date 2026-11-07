import { shortAddress, useWallet } from "../state/WalletContext.jsx";

// 머리글 오른쪽: 연결 전 '지갑 연결', 연결 후 0x1234…abcd + 연결 끊기
export default function WalletButton() {
  const { account, isSepolia, connect, disconnect, error } = useWallet();

  return (
    <div className="wallet">
      {account ? (
        <>
          <span className="address" title={account}>
            {shortAddress(account)}
          </span>
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
          Sepolia 로 바꿔 주세요
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
