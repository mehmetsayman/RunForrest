/**
 * Cüzdan katmanı — Stellar Wallets Kit.
 *
 * Stellar'da tek bir enjekte edilmiş cüzdan sağlayıcısı yok; Wallets Kit
 * Freighter, xBull, Albedo, Lobstr, Hana ve diğerlerini tek arayüzde topluyor.
 *
 * Kit tarayıcıya özgü (web component kullanıyor), bu yüzden yalnızca istemcide
 * ve tembel (lazy) olarak kuruluyor — Next.js sunucu render'ında patlamasın.
 *
 * Referans skill: skills/dapp/SKILL.md
 */

import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { NETWORK_PASSPHRASE } from "./config";

const STORAGE_WALLET = "runforrest:walletId";
const STORAGE_ADDRESS = "runforrest:address";

let kitPromise: Promise<StellarWalletsKit> | null = null;

/** Kit'i yalnızca tarayıcıda, yalnızca bir kez kurar. */
async function getKit(): Promise<StellarWalletsKit> {
  if (typeof window === "undefined") {
    throw new Error("Cüzdan yalnızca tarayıcıda kullanılabilir");
  }
  if (!kitPromise) {
    kitPromise = (async () => {
      const mod = await import("@creit.tech/stellar-wallets-kit");
      const kit = new mod.StellarWalletsKit({
        network: mod.WalletNetwork.TESTNET,
        modules: mod.allowAllModules(),
        selectedWalletId: safeGet(STORAGE_WALLET) ?? undefined,
      });
      return kit;
    })();
  }
  return kitPromise;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* özel pencere / engelli depolama: sessizce geç */
  }
}

/**
 * Cüzdan seçme penceresini açar ve adresi döndürür.
 * Kullanıcı pencereyi kapatırsa null döner — hata değil, iptal.
 */
export async function connectWallet(): Promise<string | null> {
  const kit = await getKit();

  const selected = await new Promise<string | null>((resolve) => {
    kit
      .openModal({
        modalTitle: "Cüzdanını bağla",
        onWalletSelected: (option) => resolve(option.id),
        onClosed: () => resolve(null),
      })
      .catch(() => resolve(null));
  });

  if (!selected) return null;

  kit.setWallet(selected);
  const { address } = await kit.getAddress();

  safeSet(STORAGE_WALLET, selected);
  safeSet(STORAGE_ADDRESS, address);
  return address;
}

export async function disconnectWallet(): Promise<void> {
  safeSet(STORAGE_WALLET, null);
  safeSet(STORAGE_ADDRESS, null);
  try {
    const kit = await getKit();
    await kit.disconnect();
  } catch {
    /* bazı cüzdanlarda disconnect yok; yerel durumu temizlemek yeterli */
  }
}

/**
 * Sayfa yenilendiğinde oturumu geri getirir.
 * Cüzdan artık erişilebilir değilse null döner ve yerel durum temizlenir.
 */
export async function restoreWallet(): Promise<string | null> {
  const walletId = safeGet(STORAGE_WALLET);
  const cached = safeGet(STORAGE_ADDRESS);
  if (!walletId || !cached) return null;

  try {
    const kit = await getKit();
    kit.setWallet(walletId);
    // İzin istemeden sor: kullanıcıya gereksiz pencere açma.
    const { address } = await kit.getAddress({ skipRequestAccess: true });
    if (address) {
      safeSet(STORAGE_ADDRESS, address);
      return address;
    }
  } catch {
    /* cüzdan kilitli ya da kaldırılmış */
  }
  return null;
}

/**
 * İşlem imzalar. Anchor'ın SEP-10 challenge'ı da, Soroban işlemleri de
 * bu tek yoldan geçer.
 */
export async function signTransaction(xdr: string): Promise<string> {
  const kit = await getKit();
  const address = safeGet(STORAGE_ADDRESS) ?? undefined;
  const { signedTxXdr } = await kit.signTransaction(xdr, {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  return signedTxXdr;
}

export function cachedAddress(): string | null {
  if (typeof window === "undefined") return null;
  return safeGet(STORAGE_ADDRESS);
}
