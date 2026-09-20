"use client";

/**
 * TRY ⇄ USDC ramp flow.
 *
 * The anchor speaks SEP-6, not SEP-24, so the interface is ours. This hook
 * drives the flow step by step and exposes every step to the UI, so the user
 * can always see where their money is.
 *
 * Deposit:    lock rate → get IBAN + reference code → transfer → USDC lands
 * Withdrawal: lock rate → get treasury address + memo → send USDC → TRY to IBAN
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
   * SEP-10 session. The token is valid for ~24 hours, so we fetch it once and
   * cache it, rather than prompting for a signature at every ramp step.
   */
  const session = useCallback(async (): Promise<string> => {
    if (!address) throw new Error("Connect your wallet first");
    if (jwtRef.current) return jwtRef.current;

    patch({ step: "authenticating", error: null });
    const jwt = await authenticate(address, signTransaction);
    await ensureCustomer(jwt, address);
    jwtRef.current = jwt;
    return jwt;
  }, [address]);

  /* ─────────────────────────── ON-RAMP ─────────────────────────── */

  /**
   * Starts a TRY deposit. It returns the IBAN and the reference code the user
   * must put in the transfer; USDC arrives automatically once the money lands.
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
   * Tells the anchor the transfer arrived and tracks it until USDC lands.
   *
   * SANDBOX: a real anchor has no such step — the user's bank sends the money
   * and the anchor detects it. This exists so a reviewer does not have to make
   * an actual bank transfer.
   */
  const confirmBankTransfer = useCallback(async () => {
    const { deposit, quote } = state;
    if (!deposit) throw new Error("Start the deposit first");
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
        patch({ error: done.message ?? "Deposit could not be completed" });
      }
      return done;
    } catch (e) {
      patch({ step: "error", error: (e as Error).message });
      throw e;
    }
  }, [state]);

  /* ─────────────────────────── OFF-RAMP ────────────────────────── */

  /**
   * Starts a USDC withdrawal. It returns a treasury address and a memo; the
   * payment is sent with that memo and the anchor pays out TRY to the IBAN.
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
   * Sends USDC to the anchor's treasury with the memo, then tracks the payout.
   * memo_type is "id" — sent as a text memo, the anchor cannot match it.
   */
  const sendWithdrawPayment = useCallback(
    async (amountUsdc: string) => {
      const { withdraw } = state;
      if (!withdraw) throw new Error("Start the withdrawal first");
      if (!address) throw new Error("Wallet not connected");
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

  /** Refreshes the status of an open transaction once. */
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
