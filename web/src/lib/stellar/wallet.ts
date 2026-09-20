/**
 * Wallet layer — Stellar Wallets Kit.
 *
 * Stellar has no single injected wallet provider; Wallets Kit gathers
 * Freighter, xBull, Albedo, Lobstr, Hana and others behind one interface.
 *
 * The kit is browser-only (it uses a web component), so it is set up lazily
 * and on the client alone, so Next.js server rendering does not break.
 *
 * Referans skill: skills/dapp/SKILL.md
 */

import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { NETWORK_PASSPHRASE } from "./config";

const STORAGE_WALLET = "runforrest:walletId";
const STORAGE_ADDRESS = "runforrest:address";

let kitPromise: Promise<StellarWalletsKit> | null = null;

/** Sets the kit up once, and only in the browser. */
async function getKit(): Promise<StellarWalletsKit> {
  if (typeof window === "undefined") {
    throw new Error("The wallet is only available in the browser");
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
    /* private window or blocked storage: pass over it quietly */
  }
}

/**
 * Opens the wallet picker and returns the address.
 * Returns null if the user closes it — a cancellation, not an error.
 */
export async function connectWallet(): Promise<string | null> {
  const kit = await getKit();

  const selected = await new Promise<string | null>((resolve) => {
    kit
      .openModal({
        modalTitle: "Connect your wallet",
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
    /* some wallets have no disconnect; clearing local state is enough */
  }
}

/**
 * Restores the session on page reload.
 * Returns null and clears local state if the wallet is no longer reachable.
 */
export async function restoreWallet(): Promise<string | null> {
  const walletId = safeGet(STORAGE_WALLET);
  const cached = safeGet(STORAGE_ADDRESS);
  if (!walletId || !cached) return null;

  try {
    const kit = await getKit();
    kit.setWallet(walletId);
    // Ask without prompting: do not open a needless dialog.
    const { address } = await kit.getAddress({ skipRequestAccess: true });
    if (address) {
      safeSet(STORAGE_ADDRESS, address);
      return address;
    }
  } catch {
    /* wallet locked or removed */
  }
  return null;
}

/**
 * Signs a transaction. Both the anchor's SEP-10 challenge and Soroban
 * transactions go through this single path.
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
