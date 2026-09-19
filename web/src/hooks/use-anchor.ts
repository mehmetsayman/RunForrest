"use client";

/**
 * TRY ⇄ USDC ramp akışı.
 *
 * Anchor SEP-6 konuşuyor (SEP-24 değil), yani arayüz bize ait. Bu hook akışı
 * adım adım sürüyor ve her adımı UI'a açıyor; kullanıcı parasının nerede
 * olduğunu her an görüyor.
 *
 * On-ramp:  kur kilitle → IBAN + referans kodu al → havale → USDC cüzdana
 * Off-ramp: kur kilitle → hazine adresi + memo al → USDC gönder → TRY IBAN'a
 *
 * Referans skill: CheesecakeLabs/stellar-anchor-skill/SKILL.md
 */

import { useCallback, useRef, useState } from "react";
import {
  authenticate,
  ensureCustomer,
  getTransaction,
  lockQuote,
  pollTransaction,
  simulateBankTransfer,
  startDeposit,
  startWithdraw,
} from "@/lib/anchor/client";
import type {
  DepositResponse,
  Quote,
  Sep6Transaction,
  WithdrawResponse,
} from "@/lib/anchor/types";
import { signTransaction } from "@/lib/stellar/wallet";

export type RampStep =
  | "idle"
  | "authenticating"
  | "quoting"
  | "awaiting_transfer"
  | "awaiting_payment"
  | "processing"
  | "done"
  | "error";

export type RampState = {
  step: RampStep;
  quote: Quote | null;
  deposit: DepositResponse | null;
  withdraw: WithdrawResponse | null;
  tx: Sep6Transaction | null;
  error: string | null;
};

const initial: RampState = {
  step: "idle",
  quote: null,
  deposit: null,
  withdraw: null,
  tx: null,
  error: null,
};

export function useAnchor(address: string | null) {
  const [state, setState] = useState<RampState>(initial);
  const jwtRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const patch = (p: Partial<RampState>) =>
    setState((s) => ({ ...s, ...p }));

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(initial);
  }, []);

  /**
   * SEP-10 oturumu. Token ~24 saat geçerli, bu yüzden bir kez alıp saklıyoruz;
   * her ramp adımında kullanıcıya imza penceresi açılmıyor.
   */
  const session = useCallback(async (): Promise<string> => {
    if (!address) throw new Error("Önce cüzdanı bağlayın");
    if (jwtRef.current) return jwtRef.current;

    patch({ step: "authenticating", error: null });
    const jwt = await authenticate(address, signTransaction);
    await ensureCustomer(jwt, address);
    jwtRef.current = jwt;
    return jwt;
  }, [address]);

  /* ─────────────────────────── ON-RAMP ─────────────────────────── */

  /**
   * TRY yatırımı başlatır. Dönüşte kullanıcıya IBAN ve açıklamaya yazacağı
   * referans kodu gösterilir; para gelince USDC otomatik düşer.
   */
  const startOnRamp = useCallback(
    async (amountTry: string) => {
      try {
        const jwt = await session();

        patch({ step: "quoting" });
        const quote = await lockQuote(jwt, {
          direction: "onramp",
          sellTry: amountTry,
        });

        const deposit = await startDeposit(jwt, {
          account: address!,
          amountTry,
          quoteId: quote.id,
        });

        patch({ step: "awaiting_transfer", quote, deposit });
        return deposit;
      } catch (e) {
        patch({ step: "error", error: (e as Error).message });
        throw e;
      }
    },
    [address, session],
  );

  /**
   * Havalenin geldiğini anchor'a bildirir ve USDC düşene kadar takip eder.
   *
   * SANDBOX: gerçek bir anchor'da bu adım yok — parayı kullanıcının bankası
   * gönderir ve anchor kendi tespit eder. Burada jürinin gerçek havale
   * beklemesini engellemek için var.
   */
  const confirmBankTransfer = useCallback(async () => {
    const { deposit, quote } = state;
    if (!deposit) throw new Error("Önce yatırma işlemi başlatılmalı");
    const jwt = jwtRef.current!;

    try {
      patch({ step: "processing" });
      await simulateBankTransfer(jwt, deposit.id, quote?.sell_amount);

      abortRef.current = new AbortController();
      const done = await pollTransaction(
        jwt,
        deposit.id,
        (tx) => patch({ tx }),
        { signal: abortRef.current.signal },
      );

      patch({ step: done.status === "completed" ? "done" : "error", tx: done });
      if (done.status !== "completed") {
        patch({ error: done.message ?? "Yatırma tamamlanamadı" });
      }
      return done;
    } catch (e) {
      patch({ step: "error", error: (e as Error).message });
      throw e;
    }
  }, [state]);

  /* ─────────────────────────── OFF-RAMP ────────────────────────── */

  /**
   * USDC çekimi başlatır. Dönüşte hazine adresi + memo gelir; kullanıcı
   * ödemeyi bu memo ile gönderir, anchor eşleştirip TRY'yi IBAN'a öder.
   */
  const startOffRamp = useCallback(
    async (amountUsdc: string) => {
      try {
        const jwt = await session();

        patch({ step: "quoting" });
        const quote = await lockQuote(jwt, {
          direction: "offramp",
          sellUsdc: amountUsdc,
        });

        const withdraw = await startWithdraw(jwt, {
          amountUsdc,
          quoteId: quote.id,
        });

        patch({ step: "awaiting_payment", quote, withdraw });
        return withdraw;
      } catch (e) {
        patch({ step: "error", error: (e as Error).message });
        throw e;
      }
    },
    [session],
  );

  /**
   * USDC'yi anchor hazinesine memo ile gönderir, sonra TRY ödemesini takip eder.
   * memo_type "id" — metin memo ile gönderilirse anchor eşleştiremez.
   */
  const sendWithdrawPayment = useCallback(
    async (amountUsdc: string) => {
      const { withdraw } = state;
      if (!withdraw) throw new Error("Önce çekme işlemi başlatılmalı");
      if (!address) throw new Error("Cüzdan bağlı değil");
      const jwt = jwtRef.current!;

      try {
        patch({ step: "processing" });

        const [
          { Asset, BASE_FEE, Memo, Operation, TransactionBuilder },
          { NETWORK_PASSPHRASE, USDC_CODE, USDC_ISSUER },
          { horizon },
        ] = await Promise.all([
          import("@stellar/stellar-sdk"),
          import("@/lib/stellar/config"),
          import("@/lib/stellar/contracts"),
        ]);

        const account = await horizon.loadAccount(address);
        const tx = new TransactionBuilder(account, {
          fee: String(Number(BASE_FEE) * 10),
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            Operation.payment({
              destination: withdraw.account_id,
              asset: new Asset(USDC_CODE, USDC_ISSUER),
              amount: amountUsdc,
            }),
          )
          .addMemo(Memo.id(withdraw.memo))
          .setTimeout(120)
          .build();

        const signedXdr = await signTransaction(tx.toXDR());
        const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
        await horizon.submitTransaction(
          signed as Parameters<typeof horizon.submitTransaction>[0],
        );

        abortRef.current = new AbortController();
        const done = await pollTransaction(
          jwt,
          withdraw.id,
          (t) => patch({ tx: t }),
          { signal: abortRef.current.signal },
        );

        patch({ step: done.status === "completed" ? "done" : "error", tx: done });
        return done;
      } catch (e) {
        patch({ step: "error", error: (e as Error).message });
        throw e;
      }
    },
    [address, state],
  );

  /** Açık bir işlemin durumunu tek seferlik tazeler. */
  const refreshTx = useCallback(async (id: string) => {
    const jwt = jwtRef.current;
    if (!jwt) return null;
    const tx = await getTransaction(jwt, id);
    patch({ tx });
    return tx;
  }, []);

  return {
    ...state,
    startOnRamp,
    confirmBankTransfer,
    startOffRamp,
    sendWithdrawPayment,
    refreshTx,
    reset,
  };
}
