"use client";

/**
 * Cüzdan durumu — uygulama genelinde tek kaynak.
 *
 * wagmi'nin `useAccount` + `useBalance` hook'larının yerini alıyor. Stellar'da
 * bağlantı bir tarayıcı eklentisiyle konuşmak demek; bu yüzden durum context'te
 * tutuluyor ve sayfa yenilemesinde geri getiriliyor.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  cachedAddress,
  connectWallet,
  disconnectWallet,
  restoreWallet,
} from "@/lib/stellar/wallet";
import {
  accountExists,
  createUsdcTrustline,
  fromStroops,
  fundTestnetAccount,
  hasUsdcTrustline,
  usdcBalance,
} from "@/lib/stellar/contracts";

type WalletState = {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  /** USDC bakiyesi, stroop cinsinden. */
  balance: bigint;
  /** Gösterim için ondalıklı USDC. */
  balanceFormatted: string;
  hasTrustline: boolean;
  /** Hesap zincirde açıldı mı? Yeni cüzdanlarda false. */
  isActivated: boolean;
  displayAddress: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  addTrustline: () => Promise<void>;
  /** Testnet hesabını Friendbot ile açar. */
  activateAccount: () => Promise<void>;
  error: string | null;
};

const Ctx = createContext<WalletState | null>(null);

export const truncate = (a?: string | null) =>
  a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setConnecting] = useState(false);
  const [balance, setBalance] = useState<bigint>(0n);
  const [hasTrustline, setHasTrustline] = useState(false);
  const [isActivated, setIsActivated] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async (addr: string) => {
    // Önce hesabın var olup olmadığına bak: yoksa bakiye/trustline sorgusu
    // anlamsız ve "Not Found" hatasıyla patlıyor.
    let exists = false;
    try {
      exists = await accountExists(addr);
    } catch {
      exists = false;
    }
    setIsActivated(exists);

    if (!exists) {
      setBalance(0n);
      setHasTrustline(false);
      return;
    }

    const [bal, trust] = await Promise.all([
      usdcBalance(addr),
      hasUsdcTrustline(addr),
    ]);
    setBalance(bal);
    setHasTrustline(trust);
  }, []);

  // Sayfa açılışında önceki oturumu geri getir.
  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = cachedAddress();
      if (cached && alive) setAddress(cached); // anında göster, sonra doğrula
      const restored = await restoreWallet();
      if (!alive) return;
      setAddress(restored);
      if (restored) await loadAccount(restored);
    })();
    return () => {
      alive = false;
    };
  }, [loadAccount]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const addr = await connectWallet();
      if (addr) {
        setAddress(addr);
        await loadAccount(addr);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }, [loadAccount]);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setAddress(null);
    setBalance(0n);
    setHasTrustline(false);
  }, []);

  const refresh = useCallback(async () => {
    if (address) await loadAccount(address);
  }, [address, loadAccount]);

  const activateAccount = useCallback(async () => {
    if (!address) return;
    setError(null);
    try {
      await fundTestnetAccount(address);
      await loadAccount(address);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, [address, loadAccount]);

  const addTrustline = useCallback(async () => {
    if (!address) return;
    setError(null);
    try {
      await createUsdcTrustline(address);
      await loadAccount(address);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, [address, loadAccount]);

  const value = useMemo<WalletState>(
    () => ({
      address,
      isConnected: !!address,
      isConnecting,
      balance,
      balanceFormatted: fromStroops(balance),
      hasTrustline,
      isActivated,
      displayAddress: truncate(address),
      connect,
      disconnect,
      refresh,
      addTrustline,
      activateAccount,
      error,
    }),
    [
      address,
      isConnecting,
      balance,
      hasTrustline,
      isActivated,
      connect,
      disconnect,
      refresh,
      addTrustline,
      activateAccount,
      error,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet, WalletProvider içinde kullanılmalı");
  return ctx;
}
