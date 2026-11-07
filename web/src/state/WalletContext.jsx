import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// 6단계: 지갑 연결 상태만 앱 전체에 나눠 준다 (자주 바뀌지 않는 값만).
// 서명 요청 · 개인키 · 니모닉은 이 단계에서 다루지 않는다.
export const SEPOLIA_CHAIN_ID = "0xaa36a7";

const WalletContext = createContext(null);

function getProvider() {
  return typeof window !== "undefined" ? window.ethereum : undefined;
}

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);

  // 체인 · 계정 변경 이벤트를 듣고, 정리 함수에서 반드시 해제한다
  useEffect(() => {
    const ethereum = getProvider();
    if (!ethereum?.on) return undefined;

    let active = true;
    // 체인 id 는 권한 없이 읽을 수 있는 값 — 경고 표시용
    ethereum
      .request({ method: "eth_chainId" })
      .then((id) => active && setChainId(id))
      .catch(() => {});

    function handleAccountsChanged(accounts) {
      // 화면에서 연결을 끊은 뒤에는 다시 붙이지 않는다
      setAccount((prev) => (prev ? (accounts?.[0] ?? null) : null));
    }
    function handleChainChanged(id) {
      setChainId(id);
    }

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
    return () => {
      active = false;
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const ethereum = getProvider();
    if (!ethereum?.request) {
      setError("MetaMask 가 필요합니다");
      return;
    }
    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts?.[0] ?? null);
      setError(null);
    } catch (e) {
      // 지갑이 준 메시지를 그대로 보여 주지 않고 정해진 문구만 쓴다
      setError(e?.code === 4001 ? "지갑 연결을 취소했습니다" : "지갑 연결에 실패했습니다");
    }
  }, []);

  // 화면 상태만 지운다 (MetaMask 연결 자체는 MetaMask 에서 끊는다)
  const disconnect = useCallback(() => {
    setAccount(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      account,
      chainId,
      isSepolia: chainId === SEPOLIA_CHAIN_ID,
      connect,
      disconnect,
      error,
    }),
    [account, chainId, connect, disconnect, error],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet 은 WalletProvider 안에서만 쓸 수 있습니다");
  return ctx;
}

/** 0x1234…abcd 처럼 앞 6 · 뒤 4 글자 */
export function shortAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
